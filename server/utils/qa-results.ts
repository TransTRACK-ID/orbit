import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '~/server/database'
import { ATTACHMENTS_DIR } from '~/server/utils/task-attachment-files'
import { extractJsonFromAiResponse } from '~/server/utils/parse-ai-json'
import { deriveRunStatusFromCases, finishQaRun, getQaRunDetail } from '~/server/utils/qa-runs'
import type { QaResultPayload, QaRunCaseStatus, QaRunStatus } from '~/types'

const QA_ATTACHMENTS_DIR = path.join(ATTACHMENTS_DIR, 'qa-runs')

function isQaResultPayload(parsed: unknown): parsed is QaResultPayload {
  if (!parsed || typeof parsed !== 'object') return false
  const record = parsed as Record<string, unknown>
  return typeof record.verdict === 'string' && Array.isArray(record.cases)
}

function tryParseQaResultPayload(jsonText: string): QaResultPayload | null {
  try {
    const parsed = JSON.parse(jsonText.trim())
    return isQaResultPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function extractQaResultPayload(rawText: string): QaResultPayload | null {
  if (!rawText?.trim()) return null

  // Prefer explicit ```json qa-result fences
  const labeled = /```json\s*qa-result\s*\n([\s\S]*?)```/i.exec(rawText)
  if (labeled) {
    const payload = tryParseQaResultPayload(labeled[1])
    if (payload) return payload
  }

  // Any fenced JSON block that matches the QA result contract
  const fenceRegex = /```(?:json)?\s*(?:qa-result\s*)?\n([\s\S]*?)```/gi
  let fenceMatch: RegExpExecArray | null
  while ((fenceMatch = fenceRegex.exec(rawText)) !== null) {
    const payload = tryParseQaResultPayload(fenceMatch[1])
    if (payload) return payload
  }

  // Scan balanced JSON objects from the end (agents often append qa-result last)
  const lastBrace = rawText.lastIndexOf('}')
  if (lastBrace !== -1) {
    let braceCount = 1
    for (let i = lastBrace - 1; i >= 0; i--) {
      if (rawText[i] === '}') braceCount++
      else if (rawText[i] === '{') braceCount--
      if (braceCount === 0) {
        const payload = tryParseQaResultPayload(rawText.slice(i, lastBrace + 1))
        if (payload) return payload
        break
      }
    }
  }

  try {
    const parsed = extractJsonFromAiResponse<unknown>(rawText)
    if (isQaResultPayload(parsed)) {
      return parsed
    }
  } catch {
    // ignore
  }

  return null
}

function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

export async function attachQaEvidenceFromPath(opts: {
  runCaseId: string
  sourcePath: string
  originalName?: string
}) {
  const db = getDb()
  if (!existsSync(opts.sourcePath)) {
    throw createError({ statusCode: 400, statusMessage: 'Screenshot file not found' })
  }

  const originalName = opts.originalName || path.basename(opts.sourcePath)
  const ext = path.extname(originalName) || '.png'
  const filename = `${randomUUID()}${ext}`
  const destDir = path.join(QA_ATTACHMENTS_DIR, opts.runCaseId)
  mkdirSync(destDir, { recursive: true })
  const destPath = path.join(destDir, filename)
  copyFileSync(opts.sourcePath, destPath)
  const size = statSync(destPath).size

  const [row] = await db
    .insert(schema.qaRunAttachments)
    .values({
      runCaseId: opts.runCaseId,
      filename,
      originalName,
      mimeType: mimeFromFilename(originalName),
      size,
      path: destPath,
    })
    .returning()

  return row
}

export async function applyQaResultPayload(opts: {
  runId: string
  payload: QaResultPayload
  screenshotLookup?: Map<string, string> // basename -> absolute path
}) {
  const db = getDb()
  const run = await db.query.qaRuns.findFirst({
    where: eq(schema.qaRuns.id, opts.runId),
    with: { runCases: true },
  })
  if (!run) {
    throw createError({ statusCode: 404, statusMessage: 'QA run not found' })
  }

  const byCaseId = new Map(
    (run.runCases || [])
      .filter((rc) => rc.caseId)
      .map((rc) => [rc.caseId!, rc]),
  )

  for (const result of opts.payload.cases || []) {
    const runCase = byCaseId.get(result.caseId)
    if (!runCase) continue

    await db
      .update(schema.qaRunCases)
      .set({
        status: result.status as QaRunCaseStatus,
        actual: result.actual ?? null,
        error: result.error ?? null,
      })
      .where(eq(schema.qaRunCases.id, runCase.id))

    if (opts.screenshotLookup && result.screenshots?.length) {
      for (const shotName of result.screenshots) {
        const abs = opts.screenshotLookup.get(path.basename(shotName))
          || opts.screenshotLookup.get(shotName)
        if (!abs) continue
        try {
          await attachQaEvidenceFromPath({
            runCaseId: runCase.id,
            sourcePath: abs,
            originalName: path.basename(shotName),
          })
        } catch (err) {
          console.error('[qa-results] Failed to attach screenshot:', err)
        }
      }
    }
  }

  const refreshed = await db.query.qaRuns.findFirst({
    where: eq(schema.qaRuns.id, opts.runId),
    with: { runCases: true },
  })

  const derived = deriveRunStatusFromCases((refreshed?.runCases || []).map((c) => c.status))
  const verdict = (opts.payload.verdict as QaRunStatus) || derived
  const finalStatus = ['passed', 'failed', 'blocked', 'cancelled'].includes(verdict)
    ? verdict
    : derived

  await finishQaRun(opts.runId, {
    status: finalStatus,
    summary: opts.payload.targetUrl
      ? `Target: ${opts.payload.targetUrl}`
      : null,
  })

  if (opts.payload.targetUrl) {
    await db
      .update(schema.qaRuns)
      .set({ targetUrl: opts.payload.targetUrl })
      .where(eq(schema.qaRuns.id, opts.runId))
  }

  return getQaRunDetail(opts.runId)
}

export async function applyQaResultsFromAgentReply(opts: {
  taskId: string
  agentReply: string
  /** Unformatted agent output — preferred for qa-result JSON extraction */
  rawAgentReply?: string
  screenshotPaths: string[]
}) {
  const db = getDb()
  const run = await db.query.qaRuns.findFirst({
    where: eq(schema.qaRuns.taskId, opts.taskId),
  })
  if (!run) return null

  const sourceText = opts.rawAgentReply?.trim() || opts.agentReply
  const payload = extractQaResultPayload(sourceText)
    || (opts.rawAgentReply?.trim() && opts.agentReply.trim() && opts.rawAgentReply !== opts.agentReply
      ? extractQaResultPayload(opts.agentReply)
      : null)
  if (!payload) {
    if (!sourceText.trim()) return null
    // Mark run finished based on case states if agent didn't emit structured JSON
    await finishQaRun(run.id, {
      status: 'failed',
      summary: 'Agent finished without a parseable qa-result JSON block',
    })
    return getQaRunDetail(run.id)
  }

  const screenshotLookup = new Map<string, string>()
  for (const p of opts.screenshotPaths) {
    screenshotLookup.set(path.basename(p), p)
  }

  return applyQaResultPayload({
    runId: run.id,
    payload,
    screenshotLookup,
  })
}

export function readQaAttachmentBuffer(filePath: string): Buffer {
  return readFileSync(filePath)
}
