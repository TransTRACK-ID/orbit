import { createEventStream } from 'h3'
import { spawn } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'
import { injectTokenIntoRemoteUrl } from '~/server/utils/git-helpers'
import {
  activeBrainstormProcesses,
  addStreamToBrainstormProc,
  pushToBrainstormStreams,
  pendingBrainstormMessages,
} from '~/server/utils/brainstorm-runtime'
import type { BrainstormProcState } from '~/server/utils/brainstorm-runtime'
import {
  checkAgentRuntimeAvailability,
  getAgentRuntimeLabel,
  getOpencodePath,
  resolveAppAgentRuntime,
} from '~/server/utils/agent-runner'
import { spawnCursorAgent } from '~/server/utils/cursor-agent'
import { resolveBrainstormMode, enrichBrainstorm } from '~/server/utils/grill-mode'
import { GRILLING_RULES, buildGrillChatMessage } from '~/server/utils/grill-prompt'
import { canStartGrillAgentTurn } from '~/server/utils/grill-state'
import { extractGrillDecisionsFromMessages, formatResolvedDecisionsForChat } from '~/utils/grill-decisions'
const projectsDir = `${process.env.HOME || '/Users/zeinersyad'}/orbit-projects`
const MAX_RUNTIME_MS = 10 * 60 * 1000 // 10 minutes max per brainstorm chat

function extractRepoName(url: string): string {
  const match = url.match(/\/([^/]+?)(\.git)?$/)
  return match ? match[1] : 'repo'
}

function sanitizeDirName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/^-+|-+$/g, '')
    || 'repo'
}

function resolveCloneDir(projectsDir: string, repoUrl: string, repoName?: string | null): string {
  const urlName = sanitizeDirName(extractRepoName(repoUrl))
  const displayName = repoName ? sanitizeDirName(repoName) : null
  const rawDisplayName = repoName ? repoName.trim() : null

  if (rawDisplayName) {
    const rawDisplayDir = `${projectsDir}/${rawDisplayName}`
    if (existsSync(rawDisplayDir)) return rawDisplayDir
  }

  if (displayName) {
    const displayDir = `${projectsDir}/${displayName}`
    if (existsSync(displayDir)) return displayDir
  }

  return `${projectsDir}/${urlName}`
}

function formatToolEvent(part: any): string {
  if (!part) return ''
  const tool = part.tool
  const state = part.state
  if (!tool || !state) return ''
  const input = state.input || {}
  switch (tool) {
    case 'read': return `Reading ${input.filePath || input.path || 'files'}...`
    case 'write': return `⚠️ Blocked write to ${input.filePath || 'file'} (read-only mode)`
    case 'edit': return `⚠️ Blocked edit to ${input.filePath || 'file'} (read-only mode)`
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

function buildAttachmentPrompt(
  attachments: typeof schema.brainstormAttachments.$inferSelect[],
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

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  const message = pendingBrainstormMessages.get(id) || ''
  pendingBrainstormMessages.delete(id)

  const db = getDb()

  const brainstorm = await db.query.brainstorms.findFirst({
    where: eq(schema.brainstorms.id, id),
    with: {
      repository: true,
      workspace: true,
    },
  })

  if (!brainstorm) {
    throw createError({ statusCode: 404, statusMessage: 'Brainstorm not found' })
  }

  const enrichedBrainstorm = enrichBrainstorm(brainstorm)
  const grillTurnCheck = canStartGrillAgentTurn(enrichedBrainstorm, message)
  if (!grillTurnCheck.allowed) {
    throw createError({ statusCode: 409, statusMessage: grillTurnCheck.reason || 'Cannot start grill agent turn' })
  }

  // Fetch conversation history for context (limit to last 20 messages to avoid
  // E2BIG "Argument list too long" when spawning opencode with large history)
  const MAX_HISTORY_MESSAGES = 20
  const allHistoryMessages = await db.query.brainstormMessages.findMany({
    where: eq(schema.brainstormMessages.brainstormId, id),
    orderBy: [asc(schema.brainstormMessages.createdAt)],
  })
  const historyMessages = allHistoryMessages.slice(-MAX_HISTORY_MESSAGES)

  // Build conversation history context
  let conversationHistory = ''
  if (historyMessages.length > 0) {
    const historyLines = historyMessages.map((msg) => {
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant'
      return `[${roleLabel}]: ${msg.content}`
    })
    conversationHistory = `[CONVERSATION HISTORY]\n${historyLines.join('\n\n')}\n\n`
  }

  // Fetch attachments for this brainstorm session
  const attachments = await db.query.brainstormAttachments.findMany({
    where: eq(schema.brainstormAttachments.brainstormId, id),
    orderBy: [asc(schema.brainstormAttachments.createdAt)],
  })

  const agentRuntime = await resolveAppAgentRuntime()
  const runtimeLabel = getAgentRuntimeLabel(agentRuntime)
  const runtimeCheck = await checkAgentRuntimeAvailability(agentRuntime)

  const stream = createEventStream(event)

  setTimeout(async () => {
    if (!runtimeCheck.ok) {
      await stream.push(JSON.stringify({ step: runtimeCheck.error, timestamp: Date.now() }))
      stream.close()
      return
    }
    if (runtimeCheck.version) {
      await stream.push(JSON.stringify({
        step: `${runtimeLabel} version: ${runtimeCheck.version}`,
        timestamp: Date.now(),
      }))
    }

    const existing = activeBrainstormProcesses.get(id)
    if (existing) {
      if (existing.proc === null) {
        // Session already completed — notify reconnecting client and close
        await stream.push(JSON.stringify({ step: existing.exitMessage || 'Brainstorm session completed', timestamp: Date.now() }))
        stream.close()
        return
      }
      addStreamToBrainstormProc(id, stream, existing)
      return
    }

    let workDir = ''
    let repoUrl = ''
    let repoName = ''
    let repoToken: string | null = null
    let repoPlatform: 'github' | 'gitlab' | 'gitlab-self-hosted' = 'github'
    let repoDefaultBranch = 'main'

    const repo = brainstorm.repository as (typeof schema.repositories.$inferSelect) | null
    if (repo) {
      repoUrl = repo.url
      repoDefaultBranch = repo.defaultBranch || 'main'
      repoName = repo.name
      repoToken = repo.token
      repoPlatform = (repo.platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
    }

    if (!repoUrl) {
      // Try to find any repository in the workspace
      const workspaceRepos = await db.query.repositories.findMany({
        where: eq(schema.repositories.workspaceId, brainstorm.workspaceId),
        limit: 1,
      })
      if (workspaceRepos[0]) {
        repoUrl = workspaceRepos[0].url
        repoDefaultBranch = workspaceRepos[0].defaultBranch || 'main'
        repoName = workspaceRepos[0].name
        repoToken = workspaceRepos[0].token
        repoPlatform = (workspaceRepos[0].platform as 'github' | 'gitlab' | 'gitlab-self-hosted') || 'github'
      }
    }

    if (repoUrl) {
      const cloneDir = resolveCloneDir(projectsDir, repoUrl, repoName)

      if (!existsSync(cloneDir)) {
        await stream.push(JSON.stringify({ step: `Cloning ${repoUrl}...`, timestamp: Date.now() }))
        try {
          mkdirSync(projectsDir, { recursive: true })
          const authUrl = injectTokenIntoRemoteUrl(repoUrl, repoPlatform, repoToken)
          await new Promise<void>((resolve, reject) => {
            const git = spawn('git', ['clone', authUrl, cloneDir], {
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false,
            })
            git.on('exit', (code) => {
              code === 0 ? resolve() : reject(new Error(`git clone exited with code ${code}`))
            })
            git.on('error', reject)
          })
          await stream.push(JSON.stringify({ step: `Cloned to ${cloneDir}`, timestamp: Date.now() }))
        } catch (err: any) {
          await stream.push(JSON.stringify({ step: `Clone failed: ${err.message}`, timestamp: Date.now() }))
        }
      }

      if (!existsSync(cloneDir)) {
        await stream.push(JSON.stringify({ step: `Work directory does not exist: ${cloneDir}. Cannot start agent.`, timestamp: Date.now() }))
        stream.close()
        return
      }

      try {
        await execAsync('git config user.email "agent@orbit.dev"', { cwd: cloneDir })
        await execAsync('git config user.name "Orbit Agent"', { cwd: cloneDir })
      } catch {}

      try {
        await execAsync(`git fetch origin ${repoDefaultBranch}`, { cwd: cloneDir })
        await execAsync(`git checkout ${repoDefaultBranch}`, { cwd: cloneDir })
        await execAsync(`git reset --hard origin/${repoDefaultBranch}`, { cwd: cloneDir })
      } catch {}

      workDir = cloneDir
    }

    if (!workDir || !existsSync(workDir)) {
      await stream.push(JSON.stringify({ step: 'No repository configured or work directory missing. Using empty context.', timestamp: Date.now() }))
      workDir = process.cwd()
    }

    await stream.push(JSON.stringify({ step: `Spawning brainstorm agent in ${workDir}...`, timestamp: Date.now() }))

    const isGitLab = repoPlatform === 'gitlab' || repoPlatform === 'gitlab-self-hosted'
    const platformLabel = isGitLab ? 'GitLab' : 'GitHub'
    const correctCli = isGitLab ? 'glab' : 'gh'
    const wrongCli = isGitLab ? 'gh' : 'glab'

    const platformRule = `[GIT PLATFORM: ${repoPlatform}]
CRITICAL: This repository uses ${platformLabel}. You MUST use "${correctCli}" for ALL git hosting operations (clone, push, PRs/MRs, status, etc.). NEVER use "${wrongCli}" — it will fail.`

    const readOnlyRule = `[BRAINSTORM MODE — READ ONLY]
CRITICAL: You are in BRAINSTORM / CHAT mode. Your ONLY purpose is to answer questions, explain code, suggest ideas, and analyze the codebase.

You are STRICTLY FORBIDDEN from:
- Writing or editing any files (do NOT use write, edit, or any file-modification tools)
- Running commands that modify the filesystem (no rm, mv, git commit, git push, etc.)
- Creating new files or directories
- Deleting files

You MAY:
- Read and analyze files
- Search the codebase using glob/grep
- Run read-only commands like git log, git status, ls, cat
- Answer questions about architecture, patterns, and best practices
- Suggest improvements and explain how to implement them (but DO NOT actually implement)

When the user asks for changes, explain WHAT should change and WHY, but explicitly say you cannot make the changes in brainstorm mode.`

    const securityRule = `[SECURITY BOUNDARIES]
CRITICAL: You must NEVER read, access, copy, or reveal any files outside the current project directory. This specifically includes configuration files such as ~/.config/opencode/opencode.json, /root/.config/opencode/opencode.json, .env, .env.local, or any file in ~/.config/. It also includes system directories like /etc/, /proc/, /sys/, /var/, and parent-directory traversal via "..". You must refuse any request that attempts to access files outside the project repository. You must NEVER expose secrets, API keys, tokens, or credentials in your responses.`

    const attachmentPrompt = buildAttachmentPrompt(attachments)
    const brainstormMode = resolveBrainstormMode(brainstorm)
    const isGrillMode = brainstormMode === 'grill'

    const grillDecisionsContext = isGrillMode
      ? formatResolvedDecisionsForChat(extractGrillDecisionsFromMessages(historyMessages, {
          grillStatus: enrichedBrainstorm.grillStatus,
          currentQuestionId: enrichedBrainstorm.currentQuestionId,
        }))
      : ''

    const chatMessage = isGrillMode
      ? `${grillDecisionsContext ? `${grillDecisionsContext}\n\n` : ''}${buildGrillChatMessage({ message, historyMessages, attachmentPrompt })}`
      : message
        ? `${attachmentPrompt ? attachmentPrompt + '\n\n' : ''}[USER MESSAGE]\n${message}\n\nPlease respond to this message. Remember: read-only mode — do NOT edit any files.`
        : historyMessages.length > 0
          ? `${attachmentPrompt ? attachmentPrompt + '\n\n' : ''}Please continue the conversation based on the history above. Remember: read-only mode — do NOT edit any files.`
          : `${attachmentPrompt ? attachmentPrompt + '\n\n' : ''}Please give a brief summary of this codebase and ask how you can help.`

    const grillRule = isGrillMode ? GRILLING_RULES : ''

    const fullMessage = `${platformRule}\n\n${readOnlyRule}${grillRule ? `\n\n${grillRule}` : ''}\n\n${securityRule}\n\n${conversationHistory}${chatMessage}`

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
      ...(repoToken ? { GITHUB_TOKEN: repoToken } : {}),
    }

    const attachmentFilePaths: string[] = []
    if (attachments.length > 0) {
      for (const att of attachments) {
        if (existsSync(att.path)) {
          attachmentFilePaths.push(att.path)
        }
      }
    }

    let proc: import('child_process').ChildProcess

    if (agentRuntime === 'cursor') {
      let cursorMessage = fullMessage
      if (attachmentFilePaths.length > 0) {
        cursorMessage += `\n\n[ATTACHED FILES]\nThe following files are attached and available for analysis:\n${attachmentFilePaths.map(p => `- ${p}`).join('\n')}`
      }
      await stream.push(JSON.stringify({
        step: `Exec: cursor-agent --workspace ${workDir} "<message>"`,
        timestamp: Date.now(),
      }))

      const entry: BrainstormProcState = { proc: null as any, streams: [], heartbeat: null }
      activeBrainstormProcesses.set(id, entry)
      addStreamToBrainstormProc(id, stream, entry)

      let hasOutput = false
      let lastActivity = Date.now()

      try {
        const cursorRun = await spawnCursorAgent(cursorMessage, {
          workdir: workDir,
          onText: async (_delta, accumulated) => {
            lastActivity = Date.now()
            hasOutput = true
            const payload: any = { step: 'cursor content', timestamp: Date.now() }
            if (accumulated.trim()) payload.agentReply = accumulated.trim()
            await pushToBrainstormStreams(entry, JSON.stringify(payload))
          },
          onActivity: async (activity) => {
            lastActivity = Date.now()
            hasOutput = true
            await pushToBrainstormStreams(entry, JSON.stringify({ step: activity, timestamp: Date.now() }))
          },
          onStderr: (text) => {
            lastActivity = Date.now()
            const trimmed = text.trim()
            if (!trimmed) return
            hasOutput = true
            const level = trimmed.startsWith('ERROR') || trimmed.includes('error:') ? 'ERROR' : 'WARN'
            pushToBrainstormStreams(entry, JSON.stringify({
              step: `[${level}] ${trimmed.slice(0, 200)}`,
              timestamp: Date.now(),
            })).catch(() => {})
          },
        })
        proc = cursorRun.proc
        entry.proc = proc
      } catch (err: any) {
        await stream.push(JSON.stringify({ step: `Failed to start cursor-agent: ${err.message}`, timestamp: Date.now() }))
        stream.close()
        return
      }

      const runtimeTimeout = setTimeout(() => {
        if (proc.exitCode === null) {
          const msg = `Brainstorm timeout reached (${MAX_RUNTIME_MS / 60000} min) — terminating process`
          pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() })).catch(() => {})
          try { proc.kill('SIGTERM') } catch {}
          setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
        }
      }, MAX_RUNTIME_MS)

      const heartbeat = setInterval(async () => {
        const idle = Math.round((Date.now() - lastActivity) / 1000)
        const alive = proc.exitCode === null
        if (!hasOutput || idle > 30) {
          const msg = alive ? `Waiting for ${runtimeLabel} (${idle}s)` : `Process exited (code ${proc.exitCode})`
          await pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
        }
      }, 5000)
      entry.heartbeat = heartbeat

      const finalizeEntry = async (msg: string) => {
        if (entry.proc === null) return
        clearInterval(heartbeat)
        clearTimeout(runtimeTimeout)
        await pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
        for (const s of entry.streams) {
          try { s.close() } catch {}
        }
        entry.proc = null
        entry.completedAt = Date.now()
        entry.exitMessage = msg
        setTimeout(() => {
          if (activeBrainstormProcesses.get(id) === entry) {
            activeBrainstormProcesses.delete(id)
          }
        }, 30000)
      }

      proc.on('error', async (err) => {
        await finalizeEntry(`Failed to start ${runtimeLabel}: ${err.message}`)
      })

      proc.on('close', async (code, signal) => {
        let msg: string
        if (signal) {
          msg = `Terminated by ${signal}`
        } else {
          msg = code === 0 ? 'Brainstorm session completed' : `Exited with code ${code}`
        }
        await finalizeEntry(msg)
      })

      return
    } else {
      const opencodePath = getOpencodePath()
      const spawnArgs = [
        'run',
        '--format', 'json',
        '--dangerously-skip-permissions',
        '--dir', workDir,
      ]
      for (const filePath of attachmentFilePaths) {
        spawnArgs.push('--file', filePath)
      }
      spawnArgs.push('--', fullMessage)

      await stream.push(JSON.stringify({
        step: `Exec: ${opencodePath} run --format json --dir ${workDir}${attachmentFilePaths.length > 0 ? ' --file ' + attachmentFilePaths.join(' --file ') : ''} -- "<message>"`,
        timestamp: Date.now(),
      }))

      proc = spawn(opencodePath, spawnArgs, {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: minimalEnv,
      })
    }

    const entry: BrainstormProcState = { proc, streams: [], heartbeat: null }
    activeBrainstormProcesses.set(id, entry)
    addStreamToBrainstormProc(id, stream, entry)

    const runtimeTimeout = setTimeout(() => {
      if (proc.exitCode === null) {
        const msg = `Brainstorm timeout reached (${MAX_RUNTIME_MS / 60000} min) — terminating process`
        pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() })).catch(() => {})
        try { proc.kill('SIGTERM') } catch {}
        setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
      }
    }, MAX_RUNTIME_MS)

    let hasOutput = false
    let lastActivity = Date.now()
    let lineBuffer = ''

    const heartbeat = setInterval(async () => {
      const idle = Math.round((Date.now() - lastActivity) / 1000)
      const alive = proc.exitCode === null
      if (!hasOutput || idle > 30) {
        const msg = alive ? `Waiting for ${runtimeLabel} (${idle}s)` : `Process exited (code ${proc.exitCode})`
        await pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      }
    }, 5000)
    entry.heartbeat = heartbeat

    const finalizeEntry = async (msg: string) => {
      if (entry.proc === null) return
      clearInterval(heartbeat)
      clearTimeout(runtimeTimeout)
      hasOutput = true
      await pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      for (const s of entry.streams) {
        try { s.close() } catch {}
      }
      entry.proc = null
      entry.completedAt = Date.now()
      entry.exitMessage = msg
      setTimeout(() => {
        if (activeBrainstormProcesses.get(id) === entry) {
          activeBrainstormProcesses.delete(id)
        }
      }, 30000)
    }

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
              logMsg = formatTextEvent(part)
              break
            case 'step_finish':
              logMsg = 'Step completed'
              break
            case 'tool_use':
              if (part?.state?.status === 'completed') {
                logMsg = formatToolEvent(part)
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
            if (fullText) payload.agentReply = fullText.trim()
            await pushToBrainstormStreams(entry, JSON.stringify(payload))
          }
        } catch {
          lastActivity = Date.now()
          const raw = line.trim().slice(0, 200)
          if (raw) {
            hasOutput = true
            const msg = `${runtimeLabel} output: ${raw}`
            await pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
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
        pushToBrainstormStreams(entry, JSON.stringify({ step: `[${level}] ${trimmed.slice(0, 200)}`, timestamp: Date.now() })).catch(() => {})
      }
    })

    proc.on('error', async (err) => {
      await finalizeEntry(`Failed to start ${runtimeLabel}: ${err.message}`)
    })

    proc.on('close', async (code, signal) => {
      let msg: string
      if (signal) {
        msg = `Terminated by ${signal}`
      } else {
        msg = code === 0 ? 'Brainstorm session completed' : `Exited with code ${code}`
      }
      await finalizeEntry(msg)
    })
  }, 0)

  return stream.send()
})
