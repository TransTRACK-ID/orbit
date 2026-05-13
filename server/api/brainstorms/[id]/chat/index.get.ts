import { createEventStream } from 'h3'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { accessSync, constants, existsSync, mkdirSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import {
  activeBrainstormProcesses,
  addStreamToBrainstormProc,
  pushToBrainstormStreams,
  pendingBrainstormMessages,
} from '~/server/utils/brainstorm-runtime'
import type { BrainstormProcState } from '~/server/utils/brainstorm-runtime'

const execAsync = promisify(exec)

const opencodePath = process.env.OPENCODE_PATH || '/Users/zeinersyad/.opencode/bin/opencode'
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

function injectTokenIntoRemoteUrl(url: string, platform: string, token?: string | null): string {
  const envToken = platform === 'github'
    ? (process.env.GITHUB_TOKEN || '')
    : (process.env.GITLAB_TOKEN || '')
  const effectiveToken = token || envToken
  if (!effectiveToken) return url

  if (platform === 'github') {
    if (!url.startsWith('https://github.com/')) return url
    return url.replace(/^https:\/\/github\.com\//, `https://${effectiveToken}@github.com/`)
  }

  if (!url.startsWith('https://')) return url
  return url.replace(/^https:\/\//, `https://oauth2:${effectiveToken}@`)
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

  let opencodeOk = false
  try {
    accessSync(opencodePath, constants.X_OK)
    opencodeOk = true
  } catch {}

  const stream = createEventStream(event)

  setTimeout(async () => {
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

    const existing = activeBrainstormProcesses.get(id)
    if (existing) {
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

    const chatMessage = message
      ? `[USER MESSAGE]\n${message}\n\nPlease respond to this message. Remember: read-only mode — do NOT edit any files.`
      : 'Please give a brief summary of this codebase and ask how you can help.'

    const fullMessage = `${platformRule}\n\n${readOnlyRule}\n\n${securityRule}\n\n${chatMessage}`

    const minimalEnv: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GIT_PLATFORM: repoPlatform,
      NODE_ENV: process.env.NODE_ENV,
      LANG: process.env.LANG,
      LC_ALL: process.env.LC_ALL,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      GITLAB_TOKEN: process.env.GITLAB_TOKEN,
      GITLAB_HOST: process.env.GITLAB_HOST,
    }

    const spawnArgs = [
      'run',
      '--format', 'json',
      '--dangerously-skip-permissions',
      '--dir', workDir,
      '--', fullMessage,
    ]

    await stream.push(JSON.stringify({ step: `Exec: ${opencodePath} run --format json --dir ${workDir} -- "<message>"`, timestamp: Date.now() }))

    const proc = spawn(opencodePath, spawnArgs, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: minimalEnv,
    })

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
        const msg = alive ? `Waiting for opencode (${idle}s)` : `Process exited (code ${proc.exitCode})`
        await pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
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
          const msg = `opencode output: ${raw}`
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
      clearInterval(heartbeat)
      clearTimeout(runtimeTimeout)
      hasOutput = true
      const msg = `Failed to start opencode: ${err.message}`
      await pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
    })

    proc.on('exit', async (code) => {
      clearInterval(heartbeat)
      clearTimeout(runtimeTimeout)
      hasOutput = true
      const msg = code === 0 ? 'Brainstorm session completed' : `Exited with code ${code}`
      await pushToBrainstormStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      activeBrainstormProcesses.delete(id)
    })
  }, 0)

  return stream.send()
})
