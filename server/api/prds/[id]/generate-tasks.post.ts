import { createEventStream } from 'h3'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { extractJsonFromAiResponse } from '~/server/utils/parse-ai-json'
import {
  checkAgentRuntimeAvailability,
  resolveAppAgentRuntime,
  spawnAgentPromptProcess,
} from '~/server/utils/agent-runner'
import { toPrdSectionSourceList } from '~/server/utils/to-prd-prompt'

const MAX_RUNTIME_MS = 8 * 60 * 1000 // 8 minutes

const generateTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  sections: z.array(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  const { id: prdId } = getRouterParams(event)
  const user = await requireAuth(event)
  const body = await readValidatedBody(event, generateTasksSchema.parse)
  const db = getDb()

  // Fetch PRD with sections
  const prd = await db.query.prds.findFirst({
    where: eq(schema.prds.id, prdId),
    with: { sections: true },
  })

  if (!prd) {
    throw createError({ statusCode: 404, statusMessage: 'PRD not found' })
  }

  // Filter sections if requested
  let sections = prd.sections || []
  if (body.sections && body.sections.length > 0) {
    sections = sections.filter(s => body.sections!.includes(s.sectionType))
  }

  if (sections.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No sections found to extract tasks from' })
  }

  const agentRuntime = await resolveAppAgentRuntime()
  const runtimeCheck = await checkAgentRuntimeAvailability(agentRuntime)

  const stream = createEventStream(event)

  setTimeout(async () => {
    if (!runtimeCheck.ok) {
      await stream.push(JSON.stringify({ error: runtimeCheck.error, step: 'error' }))
      stream.close()
      return
    }

    if (runtimeCheck.version) {
      await stream.push(JSON.stringify({
        step: `${agentRuntime === 'cursor' ? 'cursor-agent' : 'opencode'} version: ${runtimeCheck.version}`,
        progress: 5,
      }))
    }

    await stream.push(JSON.stringify({ step: 'Analyzing PRD sections...', progress: 10 }))

    // Build sections text - include all sections for full context
    const sectionsText = sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n')

    // Fetch existing labels for the project if available
    const projectId = body.projectId || prd.projectId
    let existingLabelsHint = ''
    if (projectId) {
      const existingLabels = await db.query.labels.findMany({
        where: eq(schema.labels.projectId, projectId),
        orderBy: (l, { asc }) => [asc(l.name)],
      })
      if (existingLabels.length > 0) {
        const labelNames = existingLabels.map(l => l.name).join(', ')
        existingLabelsHint = `\n\nExisting project labels (ONLY use these — do not invent new ones): ${labelNames}`
      }
    }

    // Use chat-style message format (same as brainstorm chat endpoint)
    const prompt = `[USER MESSAGE]

Please analyze this PRD and extract development tasks as a JSON array.

PRD Title: ${prd.title}

${sectionsText}${existingLabelsHint}

Return ONLY a JSON array with this structure:
[
  {"title": "...", "description": "...", "priority": "medium", "estimateHours": 8, "labels": ["feature"], "parentIndex": null, "sectionSource": "requirements"}
]

Rules:
- Tasks should be completable in 1-3 days
- Group related tasks with parentIndex
- Priority: urgent, high, medium, low, or none
- sectionSource: ${toPrdSectionSourceList()} (or legacy slugs overview, goals, requirements, technical_spec, acceptance_criteria, milestones, risks for older PRDs)
- Only use existing project labels if provided; do not invent new label names
- Return ONLY the JSON array, no other text`

    const workDir = process.cwd()

    await stream.push(JSON.stringify({
      step: `Generating tasks with ${agentRuntime === 'cursor' ? 'cursor-agent' : 'opencode'}...`,
      progress: 30,
    }))

    const {
      proc,
      runtimeLabel,
      accumulator,
      stdoutEnded,
      lastActivity,
      flushLineBuffer,
    } = await spawnAgentPromptProcess({
      runtime: agentRuntime,
      prompt,
      workDir,
      env: { ...process.env },
    })

    const { rawOutput, stderrOutput, debugLog } = accumulator

    const runtimeTimeout = setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGTERM')
        setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
      }
    }, MAX_RUNTIME_MS)

    const heartbeat = setInterval(async () => {
      const idle = Math.round((Date.now() - lastActivity.value) / 1000)
      if (idle > 10) {
        const alive = proc.exitCode === null
        const msg = alive ? `Generating tasks (${idle}s)...` : `Process exited (code ${proc.exitCode})`
        await stream.push(JSON.stringify({ step: msg, progress: 50 }))
      }
    }, 5000)

    proc.on('error', async (err) => {
      clearTimeout(runtimeTimeout)
      clearInterval(heartbeat)
      await stream.push(JSON.stringify({ error: `Failed to start ${runtimeLabel}: ${err.message}`, step: 'error' }))
      stream.close()
    })

    proc.on('close', async (code, signal) => {
      clearTimeout(runtimeTimeout)
      clearInterval(heartbeat)

      if (signal || code !== 0) {
        const msg = signal ? `Terminated by ${signal}` : `Exited with code ${code}`
        await stream.push(JSON.stringify({ error: msg, step: 'error' }))
        stream.close()
        return
      }

      // Wait for stdout to end (with timeout)
      let waitCount = 0
      while (!stdoutEnded.value && waitCount < 20) {
        await new Promise(resolve => setTimeout(resolve, 100))
        waitCount++
      }

      // Flush any remaining line buffer content
      flushLineBuffer()

      await stream.push(JSON.stringify({ step: 'Parsing task list...', progress: 80 }))

      // Check if we got any actual content
      if (rawOutput.value.trim().length === 0) {
        const debugInfo = {
          error: `AI model produced no text output. ${runtimeLabel} emitted only control events (e.g. step_start) but no text. This usually means the model provider failed silently — check API keys and ${runtimeLabel} config.`,
          step: 'error',
          stderrOutput: stderrOutput.value.slice(0, 1000),
          eventTypes: debugLog.eventTypes,
          rawLines: debugLog.rawLines.slice(0, 20),
        }
        await stream.push(JSON.stringify(debugInfo))
        stream.close()
        return
      }

      try {
        const parsed = extractJsonFromAiResponse<Array<{
          title: string
          description: string
          priority: string
          estimateHours: number | null
          labels: string[]
          parentIndex: number | null
          sectionSource: string
        }>>(rawOutput.value)

        if (!Array.isArray(parsed)) {
          throw new Error('Invalid task list: expected array')
        }

        await stream.push(JSON.stringify({
          step: 'Tasks generated successfully',
          progress: 100,
          done: true,
          tasks: parsed,
        }))
        stream.close()
      }
      catch (err: any) {
        const debugInfo = {
          error: `Failed to parse tasks: ${err.message}`,
          step: 'error',
          rawOutput: rawOutput.value.slice(0, 2000),
          stderrOutput: stderrOutput.value.slice(0, 1000),
          eventTypes: debugLog.eventTypes,
          rawLines: debugLog.rawLines.slice(0, 20),
        }
        await stream.push(JSON.stringify(debugInfo))
        stream.close()
      }
    })
  }, 0)

  return stream.send()
})
