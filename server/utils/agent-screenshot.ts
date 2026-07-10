import { existsSync, mkdirSync, readdirSync, realpathSync, statSync, writeFileSync } from 'fs'
import path from 'path'
import type { getDb } from '~/server/database'
import { getOrbitScreenshotsPath, ORBIT_SCREENSHOTS_DIR } from '~/server/utils/browser-mcp'
import {
  registerTaskAttachmentFromPath,
  taskAttachmentPublicPath,
  type RegisteredTaskAttachment,
} from '~/server/utils/task-attachment-files'

const SCREENSHOT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

export type AgentScreenshotAttachment = {
  id: string
  originalName: string
  url: string
}

function isScreenshotFile(filePath: string): boolean {
  return SCREENSHOT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function resolveScreenshotPath(workDir: string, filePath: string): string | null {
  const trimmed = filePath.trim()
  if (!trimmed) return null

  const candidates = [
    trimmed,
    path.isAbsolute(trimmed) ? trimmed : path.join(workDir, trimmed),
    path.join(workDir, ORBIT_SCREENSHOTS_DIR, path.basename(trimmed)),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate) && isScreenshotFile(candidate)) {
      try {
        return realpathSync(candidate)
      } catch {
        return candidate
      }
    }
  }

  return null
}

function walkScreenshotDir(dir: string, out: string[]) {
  if (!existsSync(dir)) return

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const full = path.join(dir, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      walkScreenshotDir(full, out)
    } else if (stat.isFile() && isScreenshotFile(full)) {
      try {
        out.push(realpathSync(full))
      } catch {
        out.push(full)
      }
    }
  }
}

export function collectScreenshotCandidates(workDir: string, trackedPaths: string[] = []): string[] {
  const seen = new Set<string>()
  const results: string[] = []

  const add = (filePath: string | null) => {
    if (!filePath || seen.has(filePath)) return
    seen.add(filePath)
    results.push(filePath)
  }

  for (const tracked of trackedPaths) {
    add(resolveScreenshotPath(workDir, tracked))
  }

  const screenshotsDir = getOrbitScreenshotsPath(workDir)
  const fromDir: string[] = []
  walkScreenshotDir(screenshotsDir, fromDir)
  for (const filePath of fromDir) {
    add(filePath)
  }

  return results
}

export async function harvestAgentScreenshots(options: {
  db: ReturnType<typeof getDb>
  taskId: string
  workDir: string
  trackedPaths?: string[]
}): Promise<AgentScreenshotAttachment[]> {
  const candidates = collectScreenshotCandidates(options.workDir, options.trackedPaths ?? [])
  const harvested: AgentScreenshotAttachment[] = []

  for (const filePath of candidates) {
    const attachment = await registerTaskAttachmentFromPath(
      options.db,
      options.taskId,
      filePath,
      path.basename(filePath),
    )
    if (!attachment) continue

    harvested.push(toAgentScreenshotAttachment(options.taskId, attachment))
  }

  return harvested
}

export function toAgentScreenshotAttachment(
  taskId: string,
  attachment: RegisteredTaskAttachment,
): AgentScreenshotAttachment {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    url: taskAttachmentPublicPath(taskId, attachment.id),
  }
}

export function trackScreenshotPathFromToolArgs(workDir: string, args: Record<string, unknown>): string | null {
  const filePath = args.filePath || args.path || args.outputPath
  if (typeof filePath !== 'string') return null
  return resolveScreenshotPath(workDir, filePath)
}

export function saveScreenshotFromBase64(
  workDir: string,
  base64Data: string,
  originalName = 'screenshot.png',
): string | null {
  try {
    const screenshotsDir = getOrbitScreenshotsPath(workDir)
    const dest = path.join(screenshotsDir, path.basename(originalName))
    const buffer = Buffer.from(base64Data, 'base64')
    if (buffer.length === 0) return null

    mkdirSync(screenshotsDir, { recursive: true })
    writeFileSync(dest, buffer)
    return dest
  } catch {
    return null
  }
}

export function extractBase64ImageFromToolResult(result: unknown): string | null {
  const queue: unknown[] = [result]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) continue

    if (typeof current === 'string') {
      const trimmed = current.trim()
      if (trimmed.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 120))) {
        return trimmed.replace(/\s+/g, '')
      }
      continue
    }

    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }

    if (typeof current === 'object') {
      const obj = current as Record<string, unknown>
      if (obj.type === 'image' && typeof obj.data === 'string') return obj.data
      if (typeof obj.base64 === 'string') return obj.base64
      if (typeof obj.image === 'string') return obj.image
      queue.push(...Object.values(obj))
    }
  }

  return null
}
