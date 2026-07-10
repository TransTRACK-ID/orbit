import { createEventStream, getQuery, getRequestProtocol, getRequestHost, getRequestHeaders } from 'h3'
import { spawn, exec, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import path from 'path'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc, and, ilike, or, not, gte } from 'drizzle-orm'
import { injectTokenIntoRemoteUrl } from '~/server/utils/git-helpers'
import { resolveCloneDir, resolveWorktreeDir, projectsDir } from '~/server/utils/worktree-resolver'
import { fireCrashWebhook } from '~/server/utils/crash-notify'
import { isCursorInstalled, spawnCursorAgent } from '~/server/utils/cursor-agent'

const execAsync = promisify(exec)

const MAX_DIFF_CHARS = 12000

/** Build a context block with latest code changes (stats + actual diffs) for the agent */
async function getLatestChangesContext(workDir: string, repoDefaultBranch: string): Promise<string> {
  try {
    const sections: string[] = []

    // 1. Git status — list modified/new/deleted files
    const { stdout: statusOut } = await execAsync('git status --short', { cwd: workDir }).catch(() => ({ stdout: '' }))
    if (statusOut.trim()) {
      sections.push(`Modified/uncommitted files:\n${statusOut.trim()}`)
    }

    // 2. Diff stat — show how many lines changed per file
    const { stdout: statOut } = await execAsync(`git diff --stat origin/${repoDefaultBranch}...HEAD 2>/dev/null || git diff --cached --stat || true`, { cwd: workDir }).catch(() => ({ stdout: '' }))
    if (statOut.trim()) {
      sections.push(`Change statistics:\n${statOut.trim()}`)
    }

    // 3. Recent commit messages on this branch
    const { stdout: logOut } = await execAsync(`git log origin/${repoDefaultBranch}..HEAD --format="%h %s" --no-merges 2>/dev/null || true`, { cwd: workDir }).catch(() => ({ stdout: '' }))
    if (logOut.trim()) {
      sections.push(`Commits on this branch:\n${logOut.trim()}`)
    }

    // 4. Actual diff of committed changes on this branch (truncated)
    const { stdout: committedDiff } = await execAsync(
      `git diff origin/${repoDefaultBranch}...HEAD 2>/dev/null || true`,
      { cwd: workDir }
    ).catch(() => ({ stdout: '' }))
    if (committedDiff.trim()) {
      const truncated = committedDiff.length > MAX_DIFF_CHARS
        ? committedDiff.slice(0, MAX_DIFF_CHARS) + '\n\n... (diff truncated)'
        : committedDiff
      sections.push(`Committed diff (latest branch changes):\n\`\`\`diff\n${truncated}\n\`\`\``)
    }

    // 5. Actual diff of uncommitted changes (truncated)
    const { stdout: uncommittedDiff } = await execAsync('git diff 2>/dev/null || true', { cwd: workDir }).catch(() => ({ stdout: '' }))
    if (uncommittedDiff.trim()) {
      const truncated = uncommittedDiff.length > MAX_DIFF_CHARS
        ? uncommittedDiff.slice(0, MAX_DIFF_CHARS) + '\n\n... (diff truncated)'
        : uncommittedDiff
      sections.push(`Uncommitted diff (not yet committed):\n\`\`\`diff\n${truncated}\n\`\`\``)
    }

    if (sections.length === 0) return ''

    return `\n\n[CURRENT CODEBASE STATE — latest changes]\n${sections.join('\n\n')}\n\nWhen answering the user's question, ALWAYS examine the actual diffs above. Reference specific code, file paths, and line numbers from the diffs to give an accurate, detailed answer about what was implemented.`
  } catch {
    return ''
  }
}

/** Fetch sibling task contexts and build a [SIBLING TASKS CONTEXT] block for the agent */
async function getSiblingContextBlock(
  taskId: string,
  projectId: string,
  agentId: string | null,
): Promise<string> {
  try {
    const db = getDb()
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const rows = await db.query.agentTaskContext.findMany({
      where: and(
        not(eq(schema.agentTaskContext.taskId, taskId)),
        or(
          agentId ? eq(schema.agentTaskContext.agentId, agentId) : undefined,
          eq(schema.agentTaskContext.projectId, projectId),
        ),
        or(
          eq(schema.agentTaskContext.status, 'running'),
          gte(schema.agentTaskContext.updatedAt, since24h),
        ),
      ),
      with: {
        task: { columns: { title: true } },
        agent: { columns: { name: true } },
      },
      orderBy: (ctx, { desc }) => [desc(ctx.updatedAt)],
      limit: 8,
    })

    if (rows.length === 0) return ''

    const lines = rows.map((row, i) => {
      const taskData = row.task as { title: string } | null
      const agentData = row.agent as { name: string } | null
      const title = taskData?.title ?? '(unknown)'
      const agent = agentData?.name ?? '(unknown)'
      const status = row.status.toUpperCase()
      const completedAgo = row.completedAt
        ? `${Math.round((Date.now() - new Date(row.completedAt).getTime()) / (60 * 1000))}m ago`
        : null
      const statusLabel = row.status === 'completed' && completedAgo ? `COMPLETED ${completedAgo}` : status
      const filesLine = (row.filesChanged as string[])?.length
        ? `   - Files changed: ${(row.filesChanged as string[]).slice(0, 6).join(', ')}`
        : ''
      const summaryLine = row.summary ? `   - Latest: ${row.summary.slice(0, 200)}` : ''
      const branchLine = row.branchName ? `   - Branch: ${row.branchName}` : ''
      return `${i + 1}. **Task: "${title}"** (Agent: ${agent}, Status: ${statusLabel})\n${branchLine}\n${filesLine}\n${summaryLine}`.replace(/\n+/g, '\n').trim()
    })

    return `\n\n[SIBLING TASKS CONTEXT — Other tasks in this project]\nYou are not working in isolation. Here are other tasks being handled by agents in the same project:\n\n${lines.join('\n\n')}\n\nIMPORTANT: Be aware of these parallel tasks to avoid conflicts. Do NOT modify files that other running agents are actively editing unless absolutely necessary. If your task relates to completed work, you can reference those branches.`
  } catch {
    return ''
  }
}

function formatToolEvent(part: any): string {
  if (!part) return ''
  const tool = part.tool
  const state = part.state
  if (!tool || !state) return ''
  const input = state.input || {}
  switch (tool) {
    case 'read': return `Reading ${input.filePath || input.path || 'files'}...`
    case 'write': return `Writing to ${input.filePath || 'file'}...`
    case 'edit': return `Editing ${input.filePath || 'file'}...`
    case 'bash': return `Running: ${(input.command || '').slice(0, 80)}`
    case 'glob': return `Searching: ${input.pattern || ''}`
    case 'grep': return `Searching for "${input.pattern || ''}"...`
    case 'listFiles': return `Listing ${input.dirPath || 'directory'}...`
    case 'notify': return `Notification: ${input.message || ''}`
    case 'ask': return `Question: ${input.question || ''}`
    case 'createDirectory': return `Creating directory ${input.filePath || ''}...`
    default: return `Tool: ${tool}${input.filePath || input.path ? ' - ' + (input.filePath || input.path) : ''}`
  }
}

function formatTextEvent(part: any): string {
  if (!part) return ''
  const text = typeof part === 'string' ? part : part.text || part.content || ''
  const cleaned = text.replace(/<[^>]+>/g, '').trim()
  if (!cleaned) return ''
  const lines = cleaned.split('\n').filter((l: string) => l.trim())
  if (lines.length === 0) return ''
  return lines[0].slice(0, 120)
}

import { activeProcesses, addStreamToProc, pushToStreams, pendingFeedback } from '~/server/utils/runtime'
import type { ProcState } from '~/server/utils/runtime'
import { getDefaultAgentRuntime, resolveEffectiveRuntime } from '~/server/utils/agent-runtime-config'
import {
  buildBrowserContextBlock,
  buildBrowserMandatoryRetryPrompt,
  buildNoRepositoryBlock,
  ensureCursorBrowserMcpApproved,
  extractUrlsFromText,
  getChromiumAvailability,
  isBrowserMcpTool,
  pickPrimaryBrowserTestUrl,
  resolvePreviewUrlForAgent,
  setupBrowserMcp,
  verifyCursorBrowserMcpTools,
} from '~/server/utils/browser-mcp'
import { getPreviewStatus } from '~/server/utils/preview-orchestrator'
import { getDiffSummary } from '~/server/utils/git-summary'
import { generateConventionalCommit } from '~/server/utils/conventional-commit'
import { extractAgentCommentForPersistence } from '~/utils/agent-comment'
import { AGENT_RESPONSE_MARKDOWN_RULE } from '~/utils/agent-response-format'

function generateCommitMessageFromDiff(diffContent: string, changedFiles: string[]): string {
  return generateConventionalCommit(diffContent, changedFiles)
}

/**
 * Build an attachment prompt section for the agent.
 * The actual files are passed to opencode via --file flags, so this just
 * tells the model what files are attached and instructs it to analyze them.
 */
function buildAttachmentPrompt(
  attachments: typeof schema.taskAttachments.$inferSelect[],
): string {
  if (attachments.length === 0) return ''

  const lines = attachments.map((att, idx) => {
    const safeName = att.originalName
      .replace(/[\n\r]/g, ' ')
      .replace(/[[\]]/g, '')
      .replace(/`/g, "'")
      .slice(0, 100)
    return `${idx + 1}. ${safeName} (${att.mimeType})`
  })

  return `[ATTACHED FILES]\nThe user has attached ${attachments.length} file(s) to this message. You can see and analyze them. When the user asks about these files, describe exactly what you see in them: colors, layouts, UI elements, text content, design details, people, objects, scenes, or any visual information. Do NOT say you cannot see them — these files ARE visible to you as message attachments.\n\n${lines.join('\n')}`
}

/**
 * Generate a human-readable summary paragraph describing the actual changes.
 * Used for the agent comment so users see *what* was changed in plain English.
 */
function generateHumanSummary(diffContent: string, changedFiles: string[]): string {
  const files = changedFiles.filter(f => f.trim())
  if (files.length === 0) return 'No files were changed.'

  const addedLines: string[] = []
  const removedLines: string[] = []

  for (const line of diffContent.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1).trim()
      if (content && !content.startsWith('//') && !content.startsWith('*')) {
        addedLines.push(content)
      }
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      const content = line.slice(1).trim()
      if (content && !content.startsWith('//') && !content.startsWith('*')) {
        removedLines.push(content)
      }
    }
  }

  const extractColors = (lines: string[]): string[] => {
    const colors: string[] = []
    for (const line of lines) {
      const tailwind = line.match(/\b(bg|text|border|color|fill|stroke|ring|shadow|outline|decoration)-([a-z]+-[0-9]+|current|transparent|white|black|inherit|primary|secondary)\b/)
      if (tailwind) colors.push(`${tailwind[1]} ${tailwind[2]}`)
      const hex = line.match(/#([0-9a-fA-F]{3,8})\b/)
      if (hex) colors.push(`#${hex[1]}`)
    }
    return [...new Set(colors)]
  }

  const addedColors = extractColors(addedLines)
  const removedColors = extractColors(removedLines)

  // Build sentence pieces
  const pieces: string[] = []

  // Color changes
  if (addedColors.length > 0 || removedColors.length > 0) {
    const area = files.some(f => f.includes('Sidebar')) ? 'sidebar'
      : files.some(f => f.includes('Header')) ? 'header'
      : files.some(f => f.includes('Footer')) ? 'footer'
      : files.some(f => f.includes('Button')) ? 'button'
      : files.some(f => f.includes('Card')) ? 'card'
      : files.some(f => f.includes('Modal')) ? 'modal'
      : files.some(f => f.includes('Page')) ? 'page'
      : files.some(f => f.includes('Layout')) ? 'layout'
      : 'component'

    if (removedColors.length > 0 && addedColors.length > 0) {
      pieces.push(`Changed the ${area} color from ${removedColors.join(' / ')} to ${addedColors.join(' / ')}`)
    } else if (addedColors.length > 0) {
      pieces.push(`Set the ${area} color to ${addedColors.join(' / ')}`)
    } else {
      pieces.push(`Removed the ${area} color ${removedColors.join(' / ')}`)
    }
  }

  // New components
  const addedComponents = [...new Set(addedLines.map(l => l.match(/<([A-Z][a-zA-Z0-9_-]+)/)?.[1]).filter(Boolean))]
  if (addedComponents.length > 0) {
    pieces.push(`Added ${addedComponents.join(', ')} component${addedComponents.length > 1 ? 's' : ''}`)
  }

  // New functions
  const addedFuncs = [...new Set(addedLines.map(l => l.match(/\b(?:function|const|let|var)\s+([a-zA-Z0-9_]+)/)?.[1]).filter(Boolean))]
  if (addedFuncs.length > 0) {
    pieces.push(`Added ${addedFuncs.join(', ')} function${addedFuncs.length > 1 ? 's' : ''}`)
  }

  // Import changes
  const addedImports = [...new Set(addedLines.map(l => l.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/)?.[1]).filter((x): x is string => !!x))]
  if (addedImports.length > 0) {
    pieces.push(`Added imports from ${addedImports.map(i => i.split('/').pop()).filter((x): x is string => !!x).join(', ')}`)
  }

  // Event handlers
  const hasEvents = addedLines.some(l => /\b(on[A-Z][a-zA-Z0-9]+|@click|@submit|@change|@input|v-on:)/.test(l))
  if (hasEvents) {
    pieces.push('Added event handling')
  }

  // Text changes
  const addedText = addedLines.map(l => l.match(/["']([^"']{5,})["']/)?.[1]).filter((x): x is string => !!x)
  const removedText = removedLines.map(l => l.match(/["']([^"']{5,})["']/)?.[1]).filter((x): x is string => !!x)
  if (addedText.length > 0 && removedText.length > 0) {
    pieces.push(`Updated text from "${removedText[0]!.slice(0, 30)}" to "${addedText[0]!.slice(0, 30)}"`)
  } else if (addedText.length > 0) {
    pieces.push(`Added "${addedText[0]!.slice(0, 40)}" text`)
  }

  // Fallback
  if (pieces.length === 0) {
    const names = files.map(f => f.split('/').pop()?.replace(/\.(vue|ts|js|css|scss)$/i, '') || 'file').join(', ')
    return `Updated ${names}.`
  }

  const fileList = files.length <= 3
    ? `in ${files.map(f => f.split('/').pop()).join(', ')}`
    : `across ${files.length} files`

  return `${pieces.join('; ')} ${fileList}.`
}

const opencodePath = process.env.OPENCODE_PATH || '/Users/zeinersyad/.opencode/bin/opencode'
const defaultProjectDir = process.env.PROJECT_DIR || process.cwd()

const MAX_RUNTIME_MS = 15 * 60 * 1000 // 15 minutes max per agent run

async function configureGitAuth(workDir: string, repoUrl: string, platform: string, token?: string | null) {
  if (!token) return
  const authUrl = injectTokenIntoRemoteUrl(repoUrl, platform, token)
  if (authUrl === repoUrl) return
  try {
    await execAsync(`git remote set-url origin ${authUrl}`, { cwd: workDir })
  } catch {}
}

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)
  const query = getQuery(event)
  const isAutoRestart = query.autoRestart === '1' || query.autoRestart === 'true'

  // Read and clear pending feedback (posted separately to avoid oversized URL params)
  const feedback = pendingFeedback.get(id) || ''
  pendingFeedback.delete(id)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: {
      id: true,
      title: true,
      description: true,
      statusId: true,
      projectId: true,
      repositoryId: true,
      assigneeType: true,
      agentAssigneeId: true,
      branchName: true,
    },
    with: {
      taskLabels: {
        with: { label: true },
      },
      agentAssignee: true,
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  let requestedRuntime = (task.agentAssignee?.runtime as string) || getDefaultAgentRuntime()
  if (requestedRuntime === 'browser-qa') {
    requestedRuntime = getDefaultAgentRuntime()
  }
  const agentRuntime = await resolveEffectiveRuntime(requestedRuntime)
  const runtimeFallbackMessage = requestedRuntime !== agentRuntime
    ? `Runtime "${requestedRuntime}" is disabled — falling back to "${agentRuntime}"`
    : null

  let opencodeOk = false
  let cursorOk = false
  if (agentRuntime === 'cursor') {
    cursorOk = await isCursorInstalled()
  } else {
    try {
      accessSync(opencodePath, constants.X_OK)
      opencodeOk = true
    } catch {}
  }

  const stream = createEventStream(event)

  setTimeout(async () => {
    if (agentRuntime === 'cursor') {
      if (!cursorOk) {
        await stream.push(JSON.stringify({ step: 'cursor-agent is not installed or not on PATH', timestamp: Date.now() }))
        stream.close()
        return
      }
      try {
        const { stdout } = await execAsync('cursor-agent --version', { timeout: 5000 })
        await stream.push(JSON.stringify({ step: `cursor-agent version: ${stdout.trim()}`, timestamp: Date.now() }))
      } catch (versionErr: any) {
        await stream.push(JSON.stringify({ step: `cursor-agent version check failed: ${versionErr.message}`, timestamp: Date.now() }))
      }
    } else {
      let opencodeVersion = ''
      if (opencodeOk) {
        try {
          const { stdout } = await execAsync(`"${opencodePath}" --version`, { timeout: 5000 })
          opencodeVersion = stdout.trim()
        } catch (versionErr: any) {
          opencodeVersion = `version check failed: ${versionErr.message}`
        }
      }

      if (!opencodeOk) {
        await stream.push(JSON.stringify({ step: `opencode not found at ${opencodePath}`, timestamp: Date.now() }))
        stream.close()
        return
      }
      await stream.push(JSON.stringify({ step: `opencode version: ${opencodeVersion || 'unknown'}`, timestamp: Date.now() }))
    }

    const existing = activeProcesses.get(id)
    if (existing) {
      if (feedback) {
        // New user feedback requires a fresh process so the agent sees the
        // latest instruction. Kill the existing one (if still running) and
        // fall through to spawn a new process with the feedback.
        if (!existing.exited) {
          if (existing.heartbeat) clearInterval(existing.heartbeat)
          try { existing.proc.kill('SIGTERM') } catch {}
          setTimeout(() => { try { existing.proc.kill('SIGKILL') } catch {} }, 5000)
          for (const s of existing.streams) {
            try { s.close() } catch {}
          }
        }
        activeProcesses.delete(id)
      } else {
        if (existing.exited) {
          // Process has already exited — replay logs then close the stream
          const prevLogs = await db.query.activityLogs.findMany({
            where: eq(schema.activityLogs.taskId, id),
            columns: { newValue: true },
            orderBy: [asc(schema.activityLogs.createdAt)],
            limit: 20,
          })
          for (const l of prevLogs) {
            if (l.newValue?.message) {
              await stream.push(JSON.stringify({ step: l.newValue.message, timestamp: Date.now() }))
            }
          }
          stream.close()
          return
        }
        addStreamToProc(id, stream, existing)

        const prevLogs = await db.query.activityLogs.findMany({
          where: eq(schema.activityLogs.taskId, id),
          columns: { newValue: true },
          orderBy: [asc(schema.activityLogs.createdAt)],
          limit: 20,
        })
        for (const l of prevLogs) {
          if (l.newValue?.message) {
            await stream.push(JSON.stringify({ step: l.newValue.message, timestamp: Date.now() }))
          }
        }

        return
      }
    }

    // ── Helpers for streaming + persistence ──
    const persistLog = async (msg: string) => {
      try {
        await db.insert(schema.activityLogs).values({
          taskId: id,
          userId: user.id,
          action: 'runtime_log',
          newValue: { message: msg },
        })
      } catch (err: any) {
        console.error('[execute.get] Failed to persist runtime_log:', err?.message || err)
      }
    }

    async function pushAndPersist(msg: string) {
      await stream.push(JSON.stringify({ step: msg, timestamp: Date.now() }))
      await persistLog(msg)
    }

    if (runtimeFallbackMessage) {
      await pushAndPersist(runtimeFallbackMessage)
    }

    let lineBuffer = ''
    let hasOutput = false
    let lastActivity = Date.now()
    let editCount = 0
    let editedFiles: string[] = []
    let agentReplyContent = ''
    let rawAgentStreamText = ''

    function applyAgentStreamText(fullText: string): string {
      rawAgentStreamText = fullText.trim()
      const extracted = extractAgentCommentForPersistence(rawAgentStreamText)
      if (extracted) agentReplyContent = extracted
      return extracted
    }

    // ── Loop detection: track recent bash commands ──
    const LOOP_WINDOW_MS = 60_000
    const LOOP_THRESHOLD = 4
    const CATEGORY_LOOP_THRESHOLD = 8 // higher threshold for category-based detection (e.g. many cd's)
    const commandHistory: Array<{ command: string; timestamp: number }> = []

    /** Normalize a command for loop detection: trim, collapse whitespace, extract first command from compound chains */
    function normalizeForLoop(cmd: string): string {
      let n = cmd.trim().replace(/\s+/g, ' ')
      // For compound commands (cd /path && ls, cd /path; cat file), extract just the first part
      for (const sep of [' && ', ' || ', ' ; ', ' | ']) {
        const idx = n.indexOf(sep)
        if (idx !== -1) n = n.substring(0, idx)
      }
      return n.trim()
    }

    /** Extract the base command verb (cd, ls, cat, etc.) for category-based loop detection */
    function commandCategory(cmd: string): string | null {
      const normalized = normalizeForLoop(cmd)
      const match = normalized.match(/^(cd|ls|cat|pwd|echo|find|head|tail)\b/)
      return match ? match[1] : null
    }

    let workDir = defaultProjectDir
    let branchName = ''
    let repoPlatform: 'github' | 'gitlab' | 'gitlab-self-hosted' = 'github'
    let repoDefaultBranch = 'main'
    let repoUrl = ''
    let repoName = ''
    let repoToken: string | null = null
    let mainCloneDir = ''
    let attachments: typeof schema.taskAttachments.$inferSelect[] = []

    const browserEnabled = task.agentAssignee?.browserEnabled ?? false
    const repositoryRequired = task.agentAssignee?.repositoryRequired ?? true
    await pushAndPersist(
      `Agent capabilities: browser=${browserEnabled ? 'enabled' : 'disabled'}, repository=${repositoryRequired ? 'required' : 'optional'}`,
    )

    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, task.projectId),
      columns: { workspaceId: true },
    })

    if (!repositoryRequired) {
      const home = process.env.HOME || '/root'
      workDir = path.join(home, '.orbit-sessions', id)
      mkdirSync(workDir, { recursive: true })
      await pushAndPersist(`Repository not required — session directory: ${workDir}`)
    } else if (project) {
      let createBranch = false

      await pushAndPersist(`Task ${id} repositoryId=${task.repositoryId || 'null'}, projectId=${task.projectId}`)

      if (task.repositoryId) {
        const repo = await db.query.repositories.findFirst({
          where: eq(schema.repositories.id, task.repositoryId),
        })
        if (repo) {
          repoUrl = repo.url
          repoDefaultBranch = repo.defaultBranch || 'main'
          createBranch = repo.createBranch
          repoName = repo.name
          repoToken = repo.token
          repoPlatform = (repo.platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
          await pushAndPersist(`Resolved task repository: name=${repoName}, url=${repoUrl || 'empty'}, branch=${repoDefaultBranch}`)
        } else {
          await pushAndPersist(`WARNING: Task repositoryId ${task.repositoryId} not found in database`)
        }
      }

      if (!repoUrl && project) {
        // First, try the project's repository (tasks created before the inheritance fix may not have repositoryId)
        const projectWithRepo = await db.query.projects.findFirst({
          where: eq(schema.projects.id, task.projectId),
          columns: { repositoryId: true },
        })
        if (projectWithRepo?.repositoryId) {
          const repo = await db.query.repositories.findFirst({
            where: eq(schema.repositories.id, projectWithRepo.repositoryId),
          })
          if (repo) {
            repoUrl = repo.url
            repoDefaultBranch = repo.defaultBranch || 'main'
            createBranch = repo.createBranch
            repoName = repo.name
            repoToken = repo.token
            repoPlatform = (repo.platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
            await pushAndPersist(`Using project repository: ${repo.name} (${repo.url || 'local-only'})`)
          }
        }

        // If still no repo found (repoName is empty), fall back to the first workspace repository
        if (!repoName) {
          const workspaceRepos = await db.query.repositories.findMany({
            where: eq(schema.repositories.workspaceId, project.workspaceId),
            limit: 1,
          })
          if (workspaceRepos[0]) {
            repoUrl = workspaceRepos[0].url
            repoDefaultBranch = workspaceRepos[0].defaultBranch || 'main'
            createBranch = workspaceRepos[0].createBranch
            repoName = workspaceRepos[0].name
            repoToken = workspaceRepos[0].token
            repoPlatform = (workspaceRepos[0].platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
            await pushAndPersist(`WARNING: Falling back to workspace repository: ${repoName}`)
          }
        }
      }

      if (repoUrl) {
        mainCloneDir = resolveCloneDir(repoUrl, repoName, projectsDir)
        const worktreeDir = resolveWorktreeDir(mainCloneDir, id)

        // ── Clone the main repo (bare or full) if it doesn't exist ──
        if (!existsSync(mainCloneDir)) {
          await pushAndPersist(`Cloning ${repoUrl}...`)
          try {
            mkdirSync(projectsDir, { recursive: true })
            const authUrl = injectTokenIntoRemoteUrl(repoUrl, repoPlatform, repoToken)
            await new Promise<void>((resolve, reject) => {
              const git = spawn('git', ['clone', authUrl, mainCloneDir], {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
              })
              git.on('exit', (code) => {
                code === 0 ? resolve() : reject(new Error(`git clone exited with code ${code}`))
              })
              git.on('error', reject)
            })
            await pushAndPersist(`Cloned to ${mainCloneDir}`)
          } catch (err: any) {
            await pushAndPersist(`Clone failed: ${err.message}`)
          }
        }

        // If clone failed, the directory doesn't exist — stop here
        if (!existsSync(mainCloneDir)) {
          await pushAndPersist(`Work directory does not exist: ${mainCloneDir}. Cannot start agent.`)
          stream.close()
          return
        }

        // Ensure git identity is configured so commits don't fail
        try {
          await execAsync('git config user.email "agent@orbit.dev"', { cwd: mainCloneDir })
          await execAsync('git config user.name "Orbit Agent"', { cwd: mainCloneDir })
        } catch {}

        // Inject auth token into the remote URL so push works non-interactively
        await configureGitAuth(mainCloneDir, repoUrl, repoPlatform, repoToken)

        branchName = task.branchName
          || `task-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)}`

        // Helper: clean branch name from `git branch --list` output
        function cleanBranchName(b: string): string {
          return b.trim().replace(/^[+*\s]+/, '')
        }

        // Helper: check if branch exists locally (handles *, + prefixes)
        async function hasLocalBranch(branch: string, cwd: string): Promise<boolean> {
          try {
            const { stdout } = await execAsync('git branch --list', { cwd })
            return stdout.split('\n').some(b => cleanBranchName(b) === branch)
          } catch {
            return false
          }
        }

        // ── Resolve worktree directory ──
        let actualWorktreeDir = worktreeDir
        let actualBranchName = branchName

        // If the standard worktree dir already exists on disk but isn't a valid worktree,
        // or if git reports it as locked/pruned, we'll retry with unique names.
        async function tryCreateWorktree(
          targetDir: string,
          targetBranch: string,
          attempt: number
        ): Promise<boolean> {
          await pushAndPersist(
            `Creating worktree (attempt ${attempt}): dir=${targetDir} branch=${targetBranch}`
          )

          try {
            // If the worktree directory already exists, verify it's a valid git repo
            // and is on the expected branch — if so, reuse it directly.
            if (existsSync(targetDir) && existsSync(`${targetDir}/.git`)) {
              try {
                const { stdout: currentBranch } = await execAsync('git branch --show-current', { cwd: targetDir })
                const actualBranch = currentBranch.trim()
                if (actualBranch === targetBranch) {
                  await pushAndPersist(
                    `Reusing existing worktree at ${targetDir} (branch: ${actualBranch})`
                  )
                  return true
                }
                // Wrong branch — switch to the expected one
                await pushAndPersist(
                  `Worktree exists but on branch ${actualBranch}, switching to ${targetBranch}...`
                )
                await execAsync(`git checkout ${targetBranch}`, { cwd: targetDir })
                return true
              } catch (reuseErr: any) {
                await pushAndPersist(
                  `Existing worktree at ${targetDir} is corrupt: ${reuseErr.message}. Recreating...`
                )
                // Remove the broken directory and continue to create fresh
                try {
                  await execAsync(`rm -rf "${targetDir}"`)
                } catch {}
              }
            }

            // Ensure default branch is up to date
            await execAsync(`git fetch origin ${repoDefaultBranch}`, { cwd: mainCloneDir })

            const branchExists = await hasLocalBranch(targetBranch, mainCloneDir)

            if (branchExists) {
              // Branch exists locally — try to point worktree to it
              try {
                await execAsync(
                  `git worktree add "${targetDir}" ${targetBranch}`,
                  { cwd: mainCloneDir }
                )
              } catch (pointErr: any) {
                // If pointing fails because branch is already checked out elsewhere,
                // we'll need a unique branch name on the next attempt
                if (pointErr.message?.includes('already checked out')) {
                  await pushAndPersist(
                    `Branch ${targetBranch} is already checked out in another worktree.`
                  )
                  return false
                }
                throw pointErr
              }
            } else {
              // Branch doesn't exist locally — check if it exists on remote
              let branchExistsOnRemote = false
              try {
                const { stdout: remoteBranches } = await execAsync(
                  `git ls-remote --heads origin ${targetBranch}`,
                  { cwd: mainCloneDir }
                )
                branchExistsOnRemote = !!remoteBranches.trim()
              } catch {}

              if (branchExistsOnRemote) {
                // Remote branch exists with previous agent work — restore it
                await pushAndPersist(
                  `Remote branch ${targetBranch} found — restoring previous work...`
                )
                try {
                  await execAsync(
                    `git fetch origin ${targetBranch}:${targetBranch}`,
                    { cwd: mainCloneDir }
                  )
                  await execAsync(
                    `git worktree add "${targetDir}" ${targetBranch}`,
                    { cwd: mainCloneDir }
                  )
                } catch (restoreErr: any) {
                  // If restore fails, fall back to creating from default
                  await pushAndPersist(
                    `Restore failed: ${restoreErr.message}. Creating fresh branch...`
                  )
                  await execAsync(
                    `git worktree add -b ${targetBranch} "${targetDir}" origin/${repoDefaultBranch}`,
                    { cwd: mainCloneDir }
                  )
                }
              } else {
                // No remote branch — create fresh from default branch
                try {
                  await execAsync(
                    `git worktree add -b ${targetBranch} "${targetDir}" origin/${repoDefaultBranch}`,
                    { cwd: mainCloneDir }
                  )
                } catch (createErr: any) {
                  // If -b failed because branch exists (race / stale state), retry pointing
                  if (createErr.message?.includes('already exists')) {
                    await pushAndPersist(
                      `Branch ${targetBranch} reported missing but exists. Retrying...`
                    )
                    await execAsync(
                      `git worktree add "${targetDir}" ${targetBranch}`,
                      { cwd: mainCloneDir }
                    )
                  } else {
                    throw createErr
                  }
                }
              }
            }

            await pushAndPersist(
              `Worktree created for branch "${targetBranch}" at ${targetDir}`
            )
            return true
          } catch (err: any) {
            await pushAndPersist(
              `Worktree creation failed: ${err.message}`
            )
            return false
          }
        }

        // Clean up stale worktree entries where the directory no longer exists
        try {
          const { stdout: worktreeList } = await execAsync(
            'git worktree list --porcelain',
            { cwd: mainCloneDir }
          )
          const entries = worktreeList.split('\n\n')
          for (const entry of entries) {
            const worktreePathMatch = entry.match(/worktree\s+(.+)/)
            const branchMatch = entry.match(/branch\s+(.+)/)
            if (worktreePathMatch && branchMatch) {
              const path = worktreePathMatch[1].trim()
              const branchRef = branchMatch[1].trim()
              const branchInEntry = branchRef.replace('refs/heads/', '')
              if (branchInEntry === branchName && !existsSync(path)) {
                await pushAndPersist(
                  `Removing stale worktree entry for ${branchName}...`
                )
                try {
                  await execAsync(
                    `git worktree remove --force "${path}"`,
                    { cwd: mainCloneDir }
                  )
                } catch {
                  try {
                    await execAsync('git worktree prune', { cwd: mainCloneDir })
                  } catch {}
                }
              }
            }
          }
        } catch {}

        // Attempt 1: standard names
        let worktreeCreated = await tryCreateWorktree(
          actualWorktreeDir,
          actualBranchName,
          1
        )

        // Attempt 2+: unique random suffix on both directory and branch
        let attempt = 2
        const maxAttempts = 5
        while (!worktreeCreated && attempt <= maxAttempts) {
          const suffix = Math.random().toString(36).substring(2, 8)
          actualWorktreeDir = `${worktreeDir}-${suffix}`
          actualBranchName = `${branchName}-${suffix}`
          worktreeCreated = await tryCreateWorktree(
            actualWorktreeDir,
            actualBranchName,
            attempt
          )
          attempt++
        }

        if (!worktreeCreated) {
          await pushAndPersist(
            `All ${maxAttempts} worktree creation attempts failed. Cannot start agent.`
          )
          stream.close()
          return
        }

        // Update branchName to the actual one we ended up using
        branchName = actualBranchName
        workDir = actualWorktreeDir

        // ── Copy task attachments into worktree ──
        attachments = await db.query.taskAttachments.findMany({
          where: eq(schema.taskAttachments.taskId, id),
        })

        if (attachments.length > 0) {
          const attachmentsDir = `${workDir}/.orbit-attachments`
          mkdirSync(attachmentsDir, { recursive: true })

          // Prevent git from tracking attachments
          const gitignorePath = `${attachmentsDir}/.gitignore`
          if (!existsSync(gitignorePath)) {
            writeFileSync(gitignorePath, '*\n', 'utf-8')
          }

          for (const att of attachments) {
            const source = att.path
            const dest = `${attachmentsDir}/${att.filename}`
            if (existsSync(source) && !existsSync(dest)) {
              try {
                copyFileSync(source, dest)
              } catch (copyErr: any) {
                await pushAndPersist(`Attachment copy failed: ${att.originalName} — ${copyErr.message}`)
              }
            }
          }
        }

        // Persist the actual branch name to the database so PR creation can find it later
        try {
          await db.update(schema.tasks)
            .set({ branchName: actualBranchName })
            .where(eq(schema.tasks.id, id))
        } catch (dbErr: any) {
          await pushAndPersist(`Warning: failed to save branch name to database: ${dbErr.message}`)
        }

        // Verify we're on the right branch before agent starts
        try {
          const { stdout: verifyBranch } = await execAsync('git branch --show-current', { cwd: workDir })
          const actual = verifyBranch.trim()
          if (actual !== branchName) {
            await pushAndPersist(`WARNING: Expected branch ${branchName} but on ${actual}. Switching...`)
            await execAsync(`git checkout ${branchName}`, { cwd: workDir })
          }
        } catch {}

        // Auto-commit any leftover uncommitted changes from a crashed previous run
        try {
          const { stdout: leftoverStatus } = await execAsync('git status --porcelain', { cwd: workDir }).catch(() => ({ stdout: '' }))
          if (leftoverStatus.trim()) {
            await pushAndPersist(`Uncommitted changes detected — auto-committing WIP before continuing...`)
            await execAsync('git add -A', { cwd: workDir })
            await execAsync('git commit -m "wip: autosave before next agent run"', { cwd: workDir })
            await pushAndPersist(`Auto-committed WIP.`)
          }
        } catch {}

        if (!createBranch) {
          // User disabled auto-branching: agent works on default branch directly in worktree
          branchName = repoDefaultBranch
          try {
            await execAsync(`git fetch origin ${repoDefaultBranch}`, { cwd: workDir })
            await execAsync(`git checkout ${repoDefaultBranch}`, { cwd: workDir })
            await execAsync(`git reset --hard origin/${repoDefaultBranch}`, { cwd: workDir })
            await pushAndPersist(`Reset and checked out default branch "${repoDefaultBranch}"`)
          } catch (err: any) {
            await pushAndPersist(`Branch setup failed: ${err.message}`)
          }
        }
      } else if (repoName) {
        // Local-only repository: use the local project directory directly
        workDir = `${projectsDir}/${repoName}`

        if (!existsSync(workDir)) {
          await pushAndPersist(`Local project directory does not exist: ${workDir}. Cannot start agent.`)
          stream.close()
          return
        }

        await pushAndPersist(`Using local project directory: ${workDir}`)

        // Ensure git identity is configured
        if (existsSync(`${workDir}/.git`)) {
          try {
            await execAsync('git config user.email "agent@orbit.dev"', { cwd: workDir })
            await execAsync('git config user.name "Orbit Agent"', { cwd: workDir })
          } catch {}
        }

        // Create branch name for the task
        branchName = task.branchName
          || `task-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)}`

        // Set up branch in local repo
        if (existsSync(`${workDir}/.git`)) {
          try {
            const { stdout: branchList } = await execAsync('git branch --list', { cwd: workDir })
            const hasBranch = branchList.split('\n').some(b => b.trim().replace(/^[+*\s]+/, '') === branchName)

            if (!hasBranch) {
              await execAsync(`git checkout -b ${branchName}`, { cwd: workDir })
              await pushAndPersist(`Created branch "${branchName}"`)
            } else {
              await execAsync(`git checkout ${branchName}`, { cwd: workDir })
              await pushAndPersist(`Switched to branch "${branchName}"`)
            }
          } catch (err: any) {
            await pushAndPersist(`Branch setup failed: ${err.message}`)
          }
        }

        // Copy task attachments into workDir
        attachments = await db.query.taskAttachments.findMany({
          where: eq(schema.taskAttachments.taskId, id),
        })
        if (attachments.length > 0) {
          const attachmentsDir = `${workDir}/.orbit-attachments`
          mkdirSync(attachmentsDir, { recursive: true })
          const gitignorePath = `${attachmentsDir}/.gitignore`
          if (!existsSync(gitignorePath)) {
            writeFileSync(gitignorePath, '*\n', 'utf-8')
          }
          for (const att of attachments) {
            const source = att.path
            const dest = `${attachmentsDir}/${att.filename}`
            if (existsSync(source) && !existsSync(dest)) {
              try {
                copyFileSync(source, dest)
              } catch (copyErr: any) {
                await pushAndPersist(`Attachment copy failed: ${att.originalName} — ${copyErr.message}`)
              }
            }
          }
        }

        // Persist branch name to database
        try {
          await db.update(schema.tasks)
            .set({ branchName })
            .where(eq(schema.tasks.id, id))
        } catch (dbErr: any) {
          await pushAndPersist(`Warning: failed to save branch name to database: ${dbErr.message}`)
        }

        // Verify we're on the right branch
        if (existsSync(`${workDir}/.git`)) {
          try {
            const { stdout: verifyBranch } = await execAsync('git branch --show-current', { cwd: workDir })
            const actual = verifyBranch.trim()
            if (actual !== branchName) {
              await pushAndPersist(`WARNING: Expected branch ${branchName} but on ${actual}. Switching...`)
              await execAsync(`git checkout ${branchName}`, { cwd: workDir })
            }
          } catch {}
        }

        // Auto-commit any leftover uncommitted changes
        if (existsSync(`${workDir}/.git`)) {
          try {
            const { stdout: leftoverStatus } = await execAsync('git status --porcelain', { cwd: workDir }).catch(() => ({ stdout: '' }))
            if (leftoverStatus.trim()) {
              await pushAndPersist(`Uncommitted changes detected — auto-committing WIP before continuing...`)
              await execAsync('git add -A', { cwd: workDir })
              await execAsync('git commit -m "wip: autosave before next agent run"', { cwd: workDir })
              await pushAndPersist(`Auto-committed WIP.`)
            }
          } catch {}
        }

        if (!createBranch) {
          branchName = repoDefaultBranch
          await pushAndPersist(`Using default branch "${repoDefaultBranch}"`)
        }
      }
    }

    await pushAndPersist(`Final workDir: ${workDir}, repoName: ${repoName || 'none'}, repoUrl: ${repoUrl || 'empty'}`)

    if (!existsSync(workDir)) {
      await pushAndPersist(`Work directory does not exist: ${workDir}. Cannot start agent.`)
      stream.close()
      return
    }

    let opencodeConfigPath: string | undefined
    let browserContextBlock = ''
    let usedBrowserMcp = false
    const taskUrls = browserEnabled
      ? extractUrlsFromText(task.title, task.description)
      : []
    if (browserEnabled) {
      const chromium = getChromiumAvailability()
      if (chromium.ok) {
        await pushAndPersist(`Chromium: ${chromium.message} (${chromium.path})`)
      } else {
        await pushAndPersist(`Chromium unavailable: ${chromium.message}`)
      }
      try {
        const mcpSetup = setupBrowserMcp(workDir, agentRuntime, taskUrls)
        opencodeConfigPath = mcpSetup.opencodeConfigPath
        if (mcpSetup.cursorMcpConfigPath) {
          await pushAndPersist(`Browser MCP config written: ${mcpSetup.cursorMcpConfigPath}`)
          const approval = ensureCursorBrowserMcpApproved(workDir)
          if (approval.ok) {
            await pushAndPersist(`Browser MCP approved for cursor-agent: ${approval.message}`)
          } else {
            await pushAndPersist(`Browser MCP approval warning: ${approval.message}`)
          }
          const verification = verifyCursorBrowserMcpTools(workDir)
          if (verification.ok) {
            await pushAndPersist(`Browser MCP ready: ${verification.message}`)
          } else {
            await pushAndPersist(`Browser MCP verification failed: ${verification.message}`)
          }
        }
        await pushAndPersist('Browser MCP configured (chrome-devtools, headless)')
        if (taskUrls.length > 0) {
          await pushAndPersist(`Browser target URL(s): ${taskUrls.join(', ')}`)
        }
      } catch (mcpErr: any) {
        await pushAndPersist(`Failed to configure browser MCP: ${mcpErr.message}`)
      }
      const previewInstance = await getPreviewStatus(id)
      const previewUrl = previewInstance?.status === 'running'
        ? resolvePreviewUrlForAgent(previewInstance.id)
        : null
      browserContextBlock = buildBrowserContextBlock(previewUrl, taskUrls)
      if (previewUrl) {
        await pushAndPersist(`Preview available for browser tools: ${previewUrl}`)
      }
    }

    async function finalizeAgentExit(
      code: number | null,
      signal: NodeJS.Signals | null,
      proc: ChildProcess,
      entry: ProcState,
      runtimeTimeout: NodeJS.Timeout,
      heartbeat: NodeJS.Timeout,
    ) {
      clearInterval(heartbeat)
      clearTimeout(runtimeTimeout)
      entry.exited = true

      const wasLoopKill = entry.isLoopKill
      const wasTimeoutKill = entry.isTimeoutKill

      if (
        browserEnabled
        && !usedBrowserMcp
        && code === 0
        && !wasLoopKill
        && !entry.browserRetryIssued
        && agentRuntime === 'cursor'
      ) {
        entry.browserRetryIssued = true
        const primaryUrl = pickPrimaryBrowserTestUrl(taskUrls)
        pendingFeedback.set(id, buildBrowserMandatoryRetryPrompt(primaryUrl, taskUrls))
        await pushToStreams(entry, JSON.stringify({
          step: 'Browser MCP not used — auto-retrying with mandatory browser workflow',
          autoRestart: true,
          timestamp: Date.now(),
        }))
        persistLog('Browser MCP not used — scheduling mandatory browser retry')
        activeProcesses.delete(id)
        for (const s of entry.streams) {
          try { s.close() } catch {}
        }
        return
      }

      if (browserEnabled && !usedBrowserMcp && code === 0) {
        const warning = 'Browser was enabled but no Chrome DevTools MCP tools were used — results may not reflect real browser testing.'
        await pushToStreams(entry, JSON.stringify({ step: warning, timestamp: Date.now() }))
        await persistLog(warning)
      }

      const isCrash = code === null
      const isError = code !== null && code !== 0

      if (!wasLoopKill && (isCrash || isError)) {
        const crashType = wasTimeoutKill ? 'timeout' : (isCrash ? 'crash' : 'error')
        const crashMessage = wasTimeoutKill
          ? `Agent timed out after ${MAX_RUNTIME_MS / 60000} minutes. The task exceeded the maximum runtime limit.`
          : isCrash
            ? `Agent process was killed unexpectedly (signal: ${signal ?? 'unknown'}). This may indicate OOM or a runtime crash.`
            : `Agent exited with error code ${code}`
        await pushToStreams(entry, JSON.stringify({ step: crashMessage, autoRestart: true, isCrash, isError: !isCrash, isTimeout: !!wasTimeoutKill, timestamp: Date.now() }))
        try {
          await db.insert(schema.activityLogs).values({
            taskId: id,
            userId: user.id,
            action: wasTimeoutKill ? 'agent_timeout' : (isCrash ? 'agent_crash' : 'agent_error'),
            newValue: {
              exitCode: code,
              signal: signal ?? null,
              type: crashType,
              message: crashMessage,
            },
          })
        } catch {}
        await fireCrashWebhook({
          taskId: id,
          taskTitle: task.title,
          exitCode: code,
          signal: signal ?? null,
          type: crashType,
          message: crashMessage,
        })
      }

      activeProcesses.delete(id)

      if (code === 0 && branchName && !wasLoopKill) {
        try {
          try {
            const { stdout: branchLog } = await execAsync('git log --oneline -5', { cwd: workDir })
            await pushToStreams(entry, JSON.stringify({ step: `Branch commits before: ${branchLog.replace(/\n/g, ' | ')}`, timestamp: Date.now() }))
          } catch {}

          const { stdout: status } = await execAsync('git status --porcelain --untracked-files=all', { cwd: workDir })
          const { stdout: diffOutput } = await execAsync('git diff', { cwd: workDir }).catch(() => ({ stdout: '' }))
          const { stdout: headCommit } = await execAsync('git rev-parse --short HEAD', { cwd: workDir }).catch(() => ({ stdout: 'unknown' }))

          let changedFiles: string[] = []
          let diffContent = ''
          let commitMsg = ''

          if (status.trim()) {
            await pushToStreams(entry, JSON.stringify({ step: `Git status:\n${status}`, timestamp: Date.now() }))
            await execAsync('git add -A', { cwd: workDir })

            try {
              const { stdout: nameOutput } = await execAsync('git diff --cached --name-only', { cwd: workDir })
              changedFiles = nameOutput.split('\n').map(f => f.trim()).filter(Boolean)
              const { stdout: diffOutput } = await execAsync('git diff --cached --no-ext-diff', { cwd: workDir })
              diffContent = diffOutput
            } catch {}

            const generatedMsg = generateCommitMessageFromDiff(diffContent, changedFiles)
            commitMsg = generatedMsg

            await execAsync(`git commit -m "${commitMsg}"`, { cwd: workDir })
            await pushToStreams(entry, JSON.stringify({ step: `Committed: ${commitMsg}`, timestamp: Date.now() }))

            await configureGitAuth(workDir, repoUrl, repoPlatform, repoToken)

            try {
              await execAsync(`git push -u origin ${branchName}`, { cwd: workDir })
            } catch (pushErr: any) {
              await pushToStreams(entry, JSON.stringify({ step: `Push rejected: ${pushErr.message}. Force pushing...`, timestamp: Date.now() }))
              await execAsync(`git push --force -u origin ${branchName}`, { cwd: workDir })
            }
            await pushToStreams(entry, JSON.stringify({ step: 'Pushed changes to branch', timestamp: Date.now() }))

            try {
              const { stdout: branchLogAfter } = await execAsync('git log --oneline -5', { cwd: workDir })
              await pushToStreams(entry, JSON.stringify({ step: `Branch commits after: ${branchLogAfter.replace(/\n/g, ' | ')}`, timestamp: Date.now() }))
            } catch {}
          } else {
            const editInfo = editCount > 0 ? `Agent claimed ${editCount} edit(s) on: ${editedFiles.join(', ')}` : 'Agent made no tracked edits'
            await pushToStreams(entry, JSON.stringify({ step: `No changes to push. ${editInfo}. HEAD: ${headCommit || 'unknown'}. Diff:\n${diffOutput || '(empty)'}`, timestamp: Date.now() }))

            if (editCount > 0) {
              for (const file of editedFiles.slice(0, 3)) {
                try {
                  const fullPath = path.join(workDir, file)
                  const content = readFileSync(fullPath, 'utf-8').slice(0, 200)
                  await pushToStreams(entry, JSON.stringify({ step: `File state ${file}: ${content.replace(/\n/g, ' ')}`, timestamp: Date.now() }))
                } catch (err: any) {
                  await pushToStreams(entry, JSON.stringify({ step: `Could not read ${file}: ${err.message}`, timestamp: Date.now() }))
                }
              }
            }

            try {
              const { stdout: trackedFiles } = await execAsync('git ls-files -m', { cwd: workDir })
              if (trackedFiles.trim()) {
                await pushToStreams(entry, JSON.stringify({ step: `WARNING: Modified tracked files found but not in status: ${trackedFiles.trim()}`, timestamp: Date.now() }))
              }
            } catch {}
          }

          try {
            const baseUrl = `${getRequestProtocol(event)}://${getRequestHost(event)}`
            const res = await fetch(`${baseUrl}/api/tasks/${id}/pr`, {
              method: 'POST',
              headers: { cookie: getRequestHeaders(event).cookie || '' },
            })
            if (res.ok) {
              const prResult = await res.json() as { url: string | null; noChanges?: boolean }
              if (prResult?.url) {
                await pushToStreams(entry, JSON.stringify({ step: `Created PR: ${prResult.url}`, timestamp: Date.now() }))
              } else if (prResult?.noChanges) {
                await pushToStreams(entry, JSON.stringify({ step: 'No changes to create PR from', timestamp: Date.now() }))
              }
            } else {
              const errorBody = await res.text().catch(() => '')
              const errorMsg = errorBody.slice(0, 400) || `HTTP ${res.status}`
              await pushToStreams(entry, JSON.stringify({ step: `Auto-create PR failed: ${errorMsg}`, timestamp: Date.now() }))
            }
          } catch (err: any) {
            const msg = err?.message || String(err)
            await pushToStreams(entry, JSON.stringify({ step: `Auto-create PR failed: ${msg}`, timestamp: Date.now() }))
          }

          if (agentReplyContent) {
            await pushToStreams(entry, JSON.stringify({ step: 'Agent reply already posted to comments', timestamp: Date.now() }))
          }
        } catch (err: any) {
          await pushToStreams(entry, JSON.stringify({ step: `Push failed: ${err.message}`, timestamp: Date.now() }))
        }
      }

      if (wasLoopKill) {
        const msg = 'Agent will auto-restart after loop detection'
        await pushToStreams(entry, JSON.stringify({
          step: msg,
          autoRestart: true,
          timestamp: Date.now(),
        }))
        persistLog(msg)
      } else {
        if (rawAgentStreamText) {
          const finalReply = extractAgentCommentForPersistence(rawAgentStreamText)
          if (finalReply) agentReplyContent = finalReply
        }

        const isCrashFinal = code === null
        const isErrorFinal = code !== null && code !== 0
        const msg = code === 0
          ? 'Done'
          : isCrashFinal
            ? `Agent crashed (signal: ${signal ?? 'killed'})`
            : `Agent exited with error (code ${code})`
        await pushToStreams(entry, JSON.stringify({
          step: msg,
          isCrash: isCrashFinal,
          isError: isErrorFinal,
          timestamp: Date.now(),
        }))
        persistLog(msg)

        if (agentReplyContent) {
          try {
            await db.insert(schema.activityLogs).values({
              taskId: id,
              userId: user.id,
              action: 'agent_reply',
              newValue: { message: agentReplyContent },
            })
          } catch (err: any) {
            console.error('[execute.get] Failed to persist agent_reply:', err?.message || err)
          }
        }
      }

      if (workDir && mainCloneDir && workDir !== mainCloneDir) {
        try {
          await pushAndPersist(`Keeping worktree alive for future edits`)
          try {
            await execAsync('git worktree prune', { cwd: mainCloneDir })
          } catch {}
        } catch (cleanupErr: any) {
          await pushAndPersist(`Worktree maintenance note: ${cleanupErr.message}`)
        }
      }

      if (agentTaskContextId) {
        try {
          const finalStatus = code === 0 ? 'completed' : 'error'
          const ctxSummary = agentReplyContent
            ? agentReplyContent.slice(0, 500)
            : editedFiles.length > 0
              ? `Modified: ${editedFiles.slice(0, 5).join(', ')}`
              : null
          await db.update(schema.agentTaskContext)
            .set({
              status: finalStatus,
              branchName: branchName || null,
              filesChanged: editedFiles,
              summary: ctxSummary,
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.agentTaskContext.id, agentTaskContextId))
        } catch (ctxErr: any) {
          console.error('[execute.get] Failed to update agent task context:', ctxErr?.message)
        }
      }

      for (const s of entry.streams) {
        try { s.close() } catch {}
      }
    }

    await pushAndPersist(`Spawning ${agentRuntime === 'cursor' ? 'cursor-agent' : 'opencode'} for "${task.title}" in ${workDir}...`)

    // ── Register agent task context for sibling awareness ──
    let agentTaskContextId: string | null = null
    if (task.agentAssigneeId) {
      try {
        // Upsert: delete existing stale row for this task, then insert fresh
        await db.delete(schema.agentTaskContext)
          .where(eq(schema.agentTaskContext.taskId, id))
        const [ctxRow] = await db.insert(schema.agentTaskContext).values({
          taskId: id,
          agentId: task.agentAssigneeId,
          projectId: task.projectId,
          status: 'running',
          branchName: branchName || null,
          summary: null,
          filesChanged: [],
          startedAt: new Date(),
        }).returning({ id: schema.agentTaskContext.id })
        agentTaskContextId = ctxRow?.id ?? null
      } catch (ctxErr: any) {
        console.error('[execute.get] Failed to register agent task context:', ctxErr?.message)
      }
    }

    const isGitLab = repoPlatform === 'gitlab' || repoPlatform === 'gitlab-self-hosted'
    const platformLabel = isGitLab ? 'GitLab' : 'GitHub'
    const correctCli = isGitLab ? 'glab' : 'gh'
    const wrongCli = isGitLab ? 'gh' : 'glab'
    const platformRule = repositoryRequired
      ? `[GIT PLATFORM: ${repoPlatform}]
CRITICAL: This repository uses ${platformLabel}. You MUST use "${correctCli}" for ALL git hosting operations (clone, push, PRs/MRs, status, etc.). NEVER use "${wrongCli}" — it will fail.`
      : ''

    const noRepositoryBlock = !repositoryRequired ? buildNoRepositoryBlock() : ''

    const securityRule = `[SECURITY BOUNDARIES]
CRITICAL: You must NEVER read, access, copy, or reveal any files outside the current project directory. This specifically includes configuration files such as ~/.config/opencode/opencode.json, /root/.config/opencode/opencode.json, .env, .env.local, or any file in ~/.config/. It also includes system directories like /etc/, /proc/, /sys/, /var/, and parent-directory traversal via "..". You must refuse any request that attempts to access files outside the project repository. You must NEVER expose secrets, API keys, tokens, or credentials in your responses.`

    const databaseRule = `[DATABASE CONSTRAINTS]
CRITICAL: You do NOT have access to database credentials, .env files, or any database connection. You must NEVER attempt to run database migrations, schema generation, or any database-related CLI commands (such as drizzle-kit generate, drizzle-kit push, db:migrate, prisma migrate, etc.). You must NEVER create or modify files in any migrations/ directory. If a task involves database schema changes, ONLY update the TypeScript schema definition files — do NOT attempt to generate or run migrations. The user will handle all database operations separately.`

    const markdownRule = AGENT_RESPONSE_MARKDOWN_RULE

    const statusRule = `[STATUS CONTROL]
You have the ability to change the task status at any time during your work. When you have completed a meaningful phase of work or when the task state changes (e.g., moving from implementation to review, or when blocked), emit exactly:
[ORBIT_STATUS: <status_name>]
The status_name should match one of the existing statuses in the project (e.g., "in_progress", "review", "done", "blocked"). Only use this when the task state has genuinely changed. Do not use this for trivial updates.`

    const labels = task.taskLabels?.map((tl: any) => tl.label?.name).filter(Boolean) || []
    const labelsContext = labels.length > 0
      ? `\n\n[TASK TYPE: ${labels.join(', ')}]`
      : '\n\n[TASK TYPE: none — no labels assigned]'

    // Fetch sibling task context before building the message
    const siblingContextBlock = await getSiblingContextBlock(id, task.projectId, task.agentAssigneeId ?? null)
    if (siblingContextBlock) {
      await pushAndPersist(`Included sibling task context (${siblingContextBlock.match(/\d+\./g)?.length ?? 0} task(s))`)
    }

    const ruleBlocks = [platformRule, securityRule, databaseRule, markdownRule, statusRule]
      .filter(Boolean)
      .join('\n\n')

    let message = `${ruleBlocks}${labelsContext}${noRepositoryBlock}${browserContextBlock}${siblingContextBlock}\n\n${task.title}${task.description ? `\n\n${task.description}` : ''}`
    let attachmentsInjected = false

    if (feedback) {
      if (feedback.includes('[MANDATORY BROWSER RETRY]')) {
        await pushAndPersist('Including mandatory browser retry instructions')
        message = `${browserContextBlock}\n\n${feedback}\n\n${task.title}${task.description ? `\n\n${task.description}` : ''}`
      } else if (feedback.includes('[USER MESSAGE]')) {
        // Load conversation history so the agent doesn't forget past work
        // when a new opencode process is spawned.
        const historyLogs = await db.query.activityLogs.findMany({
          where: eq(schema.activityLogs.taskId, id),
          columns: { action: true, newValue: true, createdAt: true },
          orderBy: [asc(schema.activityLogs.createdAt)],
          limit: 60,
        })
        const historyLines: string[] = []
        for (const l of historyLogs) {
          if (l.action === 'agent_reply' && l.newValue?.message) {
            historyLines.push(`Agent: ${l.newValue.message}`)
          } else if (l.action === 'runtime_log' && l.newValue?.message?.startsWith('User:')) {
            historyLines.push(l.newValue.message)
          }
        }
        const historyContext = historyLines.length > 0
          ? `\n\n[CONVERSATION HISTORY]\n${historyLines.join('\n')}\n`
          : ''

        const feedbackTail = feedback.length > 150 ? feedback.slice(0, 150) + '...' : feedback
        await pushAndPersist(`Including user message: ${feedbackTail}`)

        // Always include the latest codebase changes so the agent can answer accurately
        const changesContext = await getLatestChangesContext(workDir, repoDefaultBranch)
        if (changesContext) {
          await pushAndPersist(`Included latest codebase changes in context`)
        }

        // For follow-up user messages, embed attached images RIGHT BEFORE the user's question
        // so the model sees them in immediate context when asked about visual content.
        const attachmentPrompt = buildAttachmentPrompt(attachments)
        if (attachmentPrompt) {
          attachmentsInjected = true
        }

        message = `${ruleBlocks}${noRepositoryBlock}${browserContextBlock}${changesContext}\n\n${historyContext}${attachmentPrompt ? '\n\n' + attachmentPrompt : ''}\n\n${feedback}\n\nINSTRUCTION: The user is asking a question about the codebase or the attached images above. ALWAYS look at the [CURRENT CODEBASE STATE] section above to see what files were recently modified or committed, then examine those files before answering. If the user asks about images, describe exactly what you see in the [ATTACHED IMAGES] section. Give specific, accurate answers that reference actual code, file paths, and line numbers from the latest changes.`
      } else {
        const feedbackTail = feedback.length > 150 ? feedback.slice(0, 150) + '...' : feedback
        await pushAndPersist(`Including PR feedback: ${feedbackTail}`)

        const changesContext = await getLatestChangesContext(workDir, repoDefaultBranch)
        if (changesContext) {
          await pushAndPersist(`Included latest codebase changes in context`)
        }

        message = `CRITICAL MISSION: Fix PR Review Feedback\n\nYou are working on an EXISTING codebase that has received code review feedback. Your ONLY job is to fix the issues described in the feedback below. The code already exists — do NOT create new files unless explicitly required by the feedback.\n\nINSTRUCTIONS:\n1. Read every feedback item carefully\n2. Examine the relevant existing files mentioned in the feedback (file paths and line numbers are provided)\n3. Make precise, targeted code changes to fix EACH issue using edit/write tools\n4. Do NOT skip any feedback item — fix ALL of them\n5. Do NOT assume issues are already resolved — verify by making actual code changes\n6. After fixing all issues, confirm the changes by checking the modified files\n\n[CURRENT CODEBASE STATE]\n${changesContext || '(No local changes detected)'}\n\n[PR FEEDBACK TO ADDRESS]\n${feedback}\n\n[ORIGINAL TASK CONTEXT - for reference only]\n${message}\n\n${securityRule}\n\n${databaseRule}\n\n${markdownRule}\n\n${statusRule}`
      }
    } else if (isAutoRestart) {
      // ── Auto-restart after crash/loop/error: preserve full context ──
      await pushAndPersist(`Auto-restart: recovering historical task context...`)

      // Load conversation history so the agent doesn't forget past work
      const historyLogs = await db.query.activityLogs.findMany({
        where: eq(schema.activityLogs.taskId, id),
        columns: { action: true, newValue: true, createdAt: true },
        orderBy: [asc(schema.activityLogs.createdAt)],
        limit: 60,
      })
      const historyLines: string[] = []
      for (const l of historyLogs) {
        if (l.action === 'agent_reply' && l.newValue?.message) {
          historyLines.push(`Agent: ${l.newValue.message}`)
        } else if (l.action === 'runtime_log' && l.newValue?.message?.startsWith('User:')) {
          historyLines.push(l.newValue.message)
        }
      }
      const historyContext = historyLines.length > 0
        ? `\n\n[CONVERSATION HISTORY]\n${historyLines.join('\n')}\n`
        : ''

      // Always include the latest codebase changes
      const changesContext = await getLatestChangesContext(workDir, repoDefaultBranch)
      if (changesContext) {
        await pushAndPersist(`Auto-restart: included latest codebase changes in context`)
      }

      // Include sibling task context for awareness
      if (siblingContextBlock) {
        await pushAndPersist(`Auto-restart: included sibling task context`)
      }

      message = `${ruleBlocks}${labelsContext}${noRepositoryBlock}${browserContextBlock}${siblingContextBlock}\n\n${task.title}${task.description ? `\n\n${task.description}` : ''}\n\n[RESTART CONTEXT]\nThe previous agent run was auto-restarted (either due to a crash, error, or command loop). This is a fresh process, but ALL previous conversation history, codebase state, and sibling task context below are preserved. Review the history, check the current code state, and CONTINUE the task from where it left off. Do NOT start over — pick up the existing work and complete it.\n${changesContext}${historyContext}\n\nINSTRUCTION: Continue working on this task. You already started it — review the conversation history above and the current codebase state, then proceed to complete any remaining work. Do NOT repeat commands that were already executed successfully.`
    }

    // For initial runs and PR feedback, append attachments at the end.
    // For user-message follow-ups, attachments were already injected above (before the question).
    if (attachments.length > 0 && !attachmentsInjected) {
      const attachmentPrompt = buildAttachmentPrompt(attachments)
      if (attachmentPrompt) {
        message += `\n\n${attachmentPrompt}`
      }
    }

    // Stream CWD for live debugging but do NOT persist — avoid leaking paths in comments
    await stream.push(JSON.stringify({ step: `CWD: ${workDir}`, timestamp: Date.now() }))

    // Build a minimal environment to avoid leaking secrets or config paths
    const minimalEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_PLATFORM: repoPlatform,
      NODE_ENV: process.env.NODE_ENV,
      LANG: process.env.LANG,
      LC_ALL: process.env.LC_ALL,
      GITLAB_TOKEN: process.env.GITLAB_TOKEN,
      GITLAB_HOST: process.env.GITLAB_HOST,
      CURSOR_API_KEY: process.env.CURSOR_API_KEY,
      CURSOR_MODEL: process.env.CURSOR_MODEL,
      CURSOR_AGENT_PATH: process.env.CURSOR_AGENT_PATH,
      CHROME_PATH: process.env.CHROME_PATH,
      CHROME_EXECUTABLE_PATH: process.env.CHROME_EXECUTABLE_PATH,
      CHROME_DEVTOOLS_MCP_BIN: process.env.CHROME_DEVTOOLS_MCP_BIN,
      CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: process.env.CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS,
      ...(repoToken ? { GITHUB_TOKEN: repoToken } : {}),
      ...(opencodeConfigPath ? { OPENCODE_CONFIG: opencodeConfigPath } : {}),
    }

    if (agentRuntime === 'cursor') {
      // Cursor-agent does not support --file attachments; include paths in the prompt.
      if (attachments.length > 0) {
        const attachmentPaths = attachments
          .map((att) => `${workDir}/.orbit-attachments/${att.filename}`)
          .filter((p) => existsSync(p))
        if (attachmentPaths.length > 0) {
          message += `\n\n[ATTACHED FILES]\nThe following files are attached and available for analysis:\n${attachmentPaths.map((p) => `- ${p}`).join('\n')}`
        }
      }

      await pushAndPersist(`Exec: cursor-agent --workspace ${workDir} "<message>"`)

      try {
        const cursorRun = await spawnCursorAgent(message, {
          workdir: workDir,
          trustWorkspace: browserEnabled,
          includeAgentsMd: repositoryRequired,
          onText: async (_delta, accumulated) => {
            lastActivity = Date.now()
            hasOutput = true
            let fullText = accumulated
            const statusMatch = fullText.match(/\[ORBIT_STATUS:\s*([a-zA-Z_\- ]+)\s*\]/i)
            if (statusMatch) {
              const desiredStatus = statusMatch[1].trim().toLowerCase()
              try {
                let targetStatus = await db.query.statuses.findFirst({
                  where: and(
                    eq(schema.statuses.projectId, task.projectId),
                    ilike(schema.statuses.name, desiredStatus),
                  ),
                })
                if (!targetStatus) {
                  targetStatus = await db.query.statuses.findFirst({
                    where: and(
                      eq(schema.statuses.projectId, task.projectId),
                      ilike(schema.statuses.name, `%${desiredStatus}%`),
                    ),
                  })
                }
                if (targetStatus && task.statusId !== targetStatus.id) {
                  const oldStatus = await db.query.statuses.findFirst({
                    where: eq(schema.statuses.id, task.statusId),
                  })
                  await db.update(schema.tasks)
                    .set({ statusId: targetStatus.id })
                    .where(eq(schema.tasks.id, id))
                  await db.insert(schema.activityLogs).values({
                    taskId: id,
                    userId: user.id,
                    action: 'status_change',
                    oldValue: { statusId: task.statusId, statusName: oldStatus?.name },
                    newValue: { statusId: targetStatus.id, statusName: targetStatus.name },
                  })
                  await pushToStreams(entry, JSON.stringify({
                    step: `Agent changed status to "${targetStatus.name}"`,
                    timestamp: Date.now(),
                  }))
                  await persistLog(`Agent changed status to "${targetStatus.name}"`)
                  task.statusId = targetStatus.id
                } else if (targetStatus) {
                  await pushToStreams(entry, JSON.stringify({
                    step: `Status already "${targetStatus.name}" — no change needed`,
                    timestamp: Date.now(),
                  }))
                } else {
                  await pushToStreams(entry, JSON.stringify({
                    step: `Status "${desiredStatus}" not found in project`,
                    timestamp: Date.now(),
                  }))
                }
              } catch (statusErr: any) {
                await pushToStreams(entry, JSON.stringify({
                  step: `Failed to change status: ${statusErr.message}`,
                  timestamp: Date.now(),
                }))
              }
              fullText = fullText.replace(/\[ORBIT_STATUS:\s*[a-zA-Z_\- ]+\s*\]/i, '').trim()
            }
            const extracted = applyAgentStreamText(fullText)
            const payload: any = { step: 'cursor content', timestamp: Date.now() }
            if (extracted) payload.agentReply = extracted
            await pushToStreams(entry, JSON.stringify(payload))
          },
          onActivity: async (activity) => {
            lastActivity = Date.now()
            hasOutput = true
            if (browserEnabled && isBrowserMcpTool(activity)) {
              usedBrowserMcp = true
            }
            await pushToStreams(entry, JSON.stringify({ step: activity, timestamp: Date.now() }))
            persistLog(activity)
          },
          onToolUse: (tool, args) => {
            lastActivity = Date.now()
            hasOutput = true
            if (browserEnabled && isBrowserMcpTool(tool)) {
              usedBrowserMcp = true
              const summary = Object.entries(args)
                .map(([k, v]) => `${k}=${String(v).slice(0, 60)}`)
                .join(', ')
              const step = `Browser MCP: ${tool}(${summary})`
              pushToStreams(entry, JSON.stringify({ step, timestamp: Date.now() })).catch(() => {})
              persistLog(step)
            }
            if (tool === 'edit' || tool === 'write') {
              editCount++
              const filePath = String(args.path || args.filePath || 'unknown')
              editedFiles.push(filePath)
            }
            if (tool === 'bash') {
              const rawCmd = String(args.command || '').trim()
              if (rawCmd) {
                const normalizedCmd = normalizeForLoop(rawCmd)
                commandHistory.push({ command: normalizedCmd, timestamp: Date.now() })
                const cutoff = Date.now() - LOOP_WINDOW_MS
                while (commandHistory.length > 0 && commandHistory[0]!.timestamp < cutoff) {
                  commandHistory.shift()
                }
              }
            }
          },
          onStderr: (text) => {
            lastActivity = Date.now()
            if (!text) return
            for (const line of text.split('\n')) {
              const trimmed = line.trim()
              if (!trimmed) continue
              hasOutput = true
              const level = trimmed.startsWith('ERROR') || trimmed.includes('error:') ? 'ERROR' : 'WARN'
              const step = `[${level}] ${trimmed.slice(0, 200)}`
              pushToStreams(entry, JSON.stringify({ step, timestamp: Date.now() })).catch(() => {})
              if (level === 'ERROR') {
                persistLog(`cursor stderr: ${trimmed.slice(0, 400)}`)
              }
            }
          },
        })
        const proc = cursorRun.proc
        const entry: ProcState = { proc, streams: [], heartbeat: null, runtime: agentRuntime }
        activeProcesses.set(id, entry)
        addStreamToProc(id, stream, entry)

        const runtimeTimeout = setTimeout(() => {
          if (proc.exitCode === null) {
            entry.isTimeoutKill = true
            const msg = `Runtime timeout reached (${MAX_RUNTIME_MS / 60000} min) — terminating process`
            pushToStreams(entry, JSON.stringify({ step: msg, autoRestart: true, timestamp: Date.now() })).catch(() => {})
            persistLog(msg)
            try { proc.kill('SIGTERM') } catch {}
            setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
          }
        }, MAX_RUNTIME_MS)

        const heartbeat = setInterval(async () => {
          const idle = Math.round((Date.now() - lastActivity) / 1000)
          const alive = proc.exitCode === null

          if (alive && commandHistory.length > 0) {
            const now = Date.now()
            const counts = new Map<string, number>()
            for (const c of commandHistory) {
              if (now - c.timestamp < LOOP_WINDOW_MS) {
                counts.set(c.command, (counts.get(c.command) || 0) + 1)
              }
            }
            for (const [cmd, count] of counts) {
              if (count >= LOOP_THRESHOLD) {
                const msg = `Loop detected: "${cmd.slice(0, 60)}" executed ${count} times in ${LOOP_WINDOW_MS / 1000}s. Auto-restarting...`
                await pushToStreams(entry, JSON.stringify({ step: msg, autoRestart: true, timestamp: Date.now() }))
                await persistLog(msg)
                entry.isLoopKill = true
                clearTimeout(runtimeTimeout)
                clearInterval(heartbeat)
                try { proc.kill('SIGKILL') } catch {}
                return
              }
            }

            const categoryCounts = new Map<string, number>()
            for (const c of commandHistory) {
              if (now - c.timestamp < LOOP_WINDOW_MS) {
                const cat = commandCategory(c.command)
                if (cat) {
                  categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
                }
              }
            }
            for (const [cat, count] of categoryCounts) {
              if (count >= CATEGORY_LOOP_THRESHOLD) {
                const msg = `Category loop detected: "${cat}" commands executed ${count} times in ${LOOP_WINDOW_MS / 1000}s. Auto-restarting...`
                await pushToStreams(entry, JSON.stringify({ step: msg, autoRestart: true, timestamp: Date.now() }))
                await persistLog(msg)
                entry.isLoopKill = true
                clearTimeout(runtimeTimeout)
                clearInterval(heartbeat)
                try { proc.kill('SIGKILL') } catch {}
                return
              }
            }
          }

          if (!hasOutput || idle > 30) {
            const msg = alive ? `Waiting for cursor-agent (${idle}s)` : `Process exited (code ${proc.exitCode})`
            await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
          }
        }, 5000)
        entry.heartbeat = heartbeat

        cursorRun.promise.catch(async (err) => {
          if (entry.exited) return
          clearInterval(heartbeat)
          clearTimeout(runtimeTimeout)
          hasOutput = true
          const msg = `Cursor agent error: ${err.message}`
          await pushToStreams(entry, JSON.stringify({ step: msg, autoRestart: true, isCrash: true, timestamp: Date.now() }))
          persistLog(msg)
          try {
            await db.insert(schema.activityLogs).values({
              taskId: id,
              userId: user.id,
              action: 'agent_crash',
              newValue: {
                exitCode: null,
                signal: null,
                type: 'spawn_error',
                message: msg,
              },
            })
          } catch {}
          await fireCrashWebhook({
            taskId: id,
            taskTitle: task.title,
            exitCode: null,
            signal: null,
            type: 'spawn_error',
            message: msg,
          })
        })

        proc.on('exit', (code) => finalizeAgentExit(code, proc.signalCode ?? null, proc, entry, runtimeTimeout, heartbeat))
      } catch (err: any) {
        await stream.push(JSON.stringify({ step: `Failed to start cursor-agent: ${err.message}`, timestamp: Date.now() }))
        stream.close()
      }
    } else {
      // Build args: include --file for each attachment so opencode passes them
      // to the underlying model (Kimi k2.6) as message attachments.
      // IMPORTANT: use `--` before the message to prevent opencode from treating
      // the message text as additional file paths when --file flags are present.
      const spawnArgs = [
        'run',
        '--format', 'json',
        '--dangerously-skip-permissions',
        '--dir', workDir,
      ]
      const attachmentFilePaths: string[] = []
      if (attachments.length > 0) {
        const attachmentDir = `${workDir}/.orbit-attachments`
        for (const att of attachments) {
          const filePath = `${attachmentDir}/${att.filename}`
          if (existsSync(filePath)) {
            spawnArgs.push('--file', filePath)
            attachmentFilePaths.push(filePath)
          }
        }
      }
      spawnArgs.push('--', message)

      await pushAndPersist(`Exec: ${opencodePath} run --format json --dir ${workDir}${attachmentFilePaths.length > 0 ? ' --file ' + attachmentFilePaths.join(' --file ') : ''} -- "<message>"`)

      const proc = spawn(opencodePath, spawnArgs, {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: minimalEnv,
      })

      const entry: ProcState = { proc, streams: [], heartbeat: null, runtime: agentRuntime }
      activeProcesses.set(id, entry)
      addStreamToProc(id, stream, entry)

      // Global runtime timeout to prevent infinite hangs
      const runtimeTimeout = setTimeout(() => {
        if (proc.exitCode === null) {
          entry.isTimeoutKill = true
          const msg = `Runtime timeout reached (${MAX_RUNTIME_MS / 60000} min) — terminating process`
          pushToStreams(entry, JSON.stringify({ step: msg, autoRestart: true, timestamp: Date.now() })).catch(() => {})
          persistLog(msg)
          try { proc.kill('SIGTERM') } catch {}
          setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
        }
      }, MAX_RUNTIME_MS)

      const heartbeat = setInterval(async () => {
        const idle = Math.round((Date.now() - lastActivity) / 1000)
        const alive = proc.exitCode === null

        // ── Loop detection ──
        if (alive && commandHistory.length > 0) {
          const now = Date.now()
          const counts = new Map<string, number>()
          for (const c of commandHistory) {
            if (now - c.timestamp < LOOP_WINDOW_MS) {
              counts.set(c.command, (counts.get(c.command) || 0) + 1)
            }
          }
          for (const [cmd, count] of counts) {
            if (count >= LOOP_THRESHOLD) {
              const msg = `Loop detected: "${cmd.slice(0, 60)}" executed ${count} times in ${LOOP_WINDOW_MS / 1000}s. Auto-restarting...`
              await pushToStreams(entry, JSON.stringify({ step: msg, autoRestart: true, timestamp: Date.now() }))
              await persistLog(msg)
              entry.isLoopKill = true
              clearTimeout(runtimeTimeout)
              clearInterval(heartbeat)
              try { proc.kill('SIGKILL') } catch {}
              return
            }
          }

          // Category-based loop detection: catch patterns like many `cd /different/path` commands
          const categoryCounts = new Map<string, number>()
          for (const c of commandHistory) {
            if (now - c.timestamp < LOOP_WINDOW_MS) {
              const cat = commandCategory(c.command)
              if (cat) {
                categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
              }
            }
          }
          for (const [cat, count] of categoryCounts) {
            if (count >= CATEGORY_LOOP_THRESHOLD) {
              const msg = `Category loop detected: "${cat}" commands executed ${count} times in ${LOOP_WINDOW_MS / 1000}s. Auto-restarting...`
              await pushToStreams(entry, JSON.stringify({ step: msg, autoRestart: true, timestamp: Date.now() }))
              await persistLog(msg)
              entry.isLoopKill = true
              clearTimeout(runtimeTimeout)
              clearInterval(heartbeat)
              try { proc.kill('SIGKILL') } catch {}
              return
            }
          }
        }

        // Always report long idle times so users can see if it's stuck
        if (!hasOutput || idle > 30) {
          const msg = alive ? `Waiting for opencode (${idle}s)` : `Process exited (code ${proc.exitCode})`
          await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
        }
      }, 5000)
      entry.heartbeat = heartbeat

      const parseAndPush = async (line: string) => {
        if (!line.trim()) return
        try {
          const evt = JSON.parse(line)
          const part = evt.part
          let logMsg = ''
          let fullText = ''

          switch (evt.type) {
            case 'step_start':
              logMsg = 'Step started'
              break
            case 'text':
              fullText = typeof part === 'string' ? part : part.text || part.content || ''
              // Capture agent text responses for persistence.
              // The [AGENT_REPLY] marker is added by the frontend, not by opencode,
              // so we track the latest text as the agent's reply.
              if (fullText) {
                // Detect status change markers from the agent
                const statusMatch = fullText.match(/\[ORBIT_STATUS:\s*([a-zA-Z_\- ]+)\s*\]/i)
                if (statusMatch) {
                  const desiredStatus = statusMatch[1].trim().toLowerCase()
                  try {
                    // Try exact match first
                    let targetStatus = await db.query.statuses.findFirst({
                      where: and(
                        eq(schema.statuses.projectId, task.projectId),
                        ilike(schema.statuses.name, desiredStatus),
                      ),
                    })
                    // Fallback to partial match
                    if (!targetStatus) {
                      targetStatus = await db.query.statuses.findFirst({
                        where: and(
                          eq(schema.statuses.projectId, task.projectId),
                          ilike(schema.statuses.name, `%${desiredStatus}%`),
                        ),
                      })
                    }
                    if (targetStatus && task.statusId !== targetStatus.id) {
                      const oldStatus = await db.query.statuses.findFirst({
                        where: eq(schema.statuses.id, task.statusId),
                      })
                      await db.update(schema.tasks)
                        .set({ statusId: targetStatus.id })
                        .where(eq(schema.tasks.id, id))
                      await db.insert(schema.activityLogs).values({
                        taskId: id,
                        userId: user.id,
                        action: 'status_change',
                        oldValue: { statusId: task.statusId, statusName: oldStatus?.name },
                        newValue: { statusId: targetStatus.id, statusName: targetStatus.name },
                      })
                      await pushToStreams(entry, JSON.stringify({
                        step: `Agent changed status to "${targetStatus.name}"`,
                        timestamp: Date.now(),
                      }))
                      await persistLog(`Agent changed status to "${targetStatus.name}"`)
                      task.statusId = targetStatus.id
                    } else if (targetStatus) {
                      await pushToStreams(entry, JSON.stringify({
                        step: `Status already "${targetStatus.name}" — no change needed`,
                        timestamp: Date.now(),
                      }))
                    } else {
                      await pushToStreams(entry, JSON.stringify({
                        step: `Status "${desiredStatus}" not found in project`,
                        timestamp: Date.now(),
                      }))
                    }
                  } catch (statusErr: any) {
                    await pushToStreams(entry, JSON.stringify({
                      step: `Failed to change status: ${statusErr.message}`,
                      timestamp: Date.now(),
                    }))
                  }
                  // Remove the marker from the displayed text
                  fullText = fullText.replace(/\[ORBIT_STATUS:\s*[a-zA-Z_\- ]+\s*\]/i, '').trim()
                }
                applyAgentStreamText(fullText)
              }
              logMsg = formatTextEvent(part)
              break
            case 'step_finish':
              logMsg = 'Step completed'
              break
            case 'tool_use':
              if (part?.state?.status === 'completed') {
                logMsg = formatToolEvent(part)
                const tool = part?.tool
                const input = part?.state?.input || {}
                if (browserEnabled && tool && isBrowserMcpTool(String(tool))) {
                  usedBrowserMcp = true
                }
                if (tool === 'edit' || tool === 'write') {
                  editCount++
                  const filePath = input.filePath || input.path || 'unknown'
                  editedFiles.push(filePath)
                }
                // Track bash commands for loop detection (normalized for better matching)
                if (tool === 'bash') {
                  const rawCmd = (input.command || '').trim()
                  if (rawCmd) {
                    const normalizedCmd = normalizeForLoop(rawCmd)
                    commandHistory.push({ command: normalizedCmd, timestamp: Date.now() })
                    // Prune old entries
                    const cutoff = Date.now() - LOOP_WINDOW_MS
                    while (commandHistory.length > 0 && commandHistory[0]!.timestamp < cutoff) {
                      commandHistory.shift()
                    }
                  }
                }
              }
              break
            case 'step_error':
              logMsg = `Error: ${part?.error || 'unknown error'}`
              break
            default:
              if (typeof part === 'string') {
                logMsg = part.slice(0, 120)
              }
          }

          if (logMsg || fullText) {
            hasOutput = true
            lastActivity = Date.now()
            const payload: any = { step: logMsg, timestamp: Date.now() }
            if (fullText) {
              const extracted = applyAgentStreamText(fullText)
              if (extracted) payload.agentReply = extracted
            }
            await pushToStreams(entry, JSON.stringify(payload))
            if (logMsg) persistLog(logMsg)
          }
        } catch (parseErr: any) {
          // Not valid JSON — could be startup logs, errors, or partial output
          lastActivity = Date.now()
          const raw = line.trim().slice(0, 200)
          if (raw) {
            hasOutput = true
            const msg = `opencode output: ${raw}`
            await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
            persistLog(msg)
          }
        }
      }

      proc.stdout?.on('data', (chunk: Buffer) => {
        lineBuffer += chunk.toString()
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() || ''
        for (const line of lines) {
          if (line.trim()) parseAndPush(line.trim())
        }
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        lastActivity = Date.now()
        const text = chunk.toString().trim()
        if (!text) return
        for (const line of text.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          hasOutput = true
          const level = trimmed.startsWith('ERROR') || trimmed.includes('error:') ? 'ERROR' : 'WARN'
          pushToStreams(entry, JSON.stringify({ step: `[${level}] ${trimmed.slice(0, 200)}`, timestamp: Date.now() })).catch(() => {})
        }
      })

      proc.on('error', async (err) => {
        clearInterval(heartbeat)
        clearTimeout(runtimeTimeout)
        hasOutput = true
        const msg = `Failed to start opencode: ${err.message}`
        await pushToStreams(entry, JSON.stringify({ step: msg, autoRestart: true, isCrash: true, timestamp: Date.now() }))
        persistLog(msg)
        // Persist structured crash log
        try {
          await db.insert(schema.activityLogs).values({
            taskId: id,
            userId: user.id,
            action: 'agent_crash',
            newValue: {
              exitCode: null,
              signal: null,
              type: 'spawn_error',
              message: msg,
            },
          })
        } catch {}
        // Fire webhook notification
        await fireCrashWebhook({
          taskId: id,
          taskTitle: task.title,
          exitCode: null,
          signal: null,
          type: 'spawn_error',
          message: msg,
        })
      })

      proc.on('exit', (code) => finalizeAgentExit(code, proc.signalCode ?? null, proc, entry, runtimeTimeout, heartbeat))
    }
  }, 10)

  return stream.send()
})
