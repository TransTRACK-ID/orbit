import { createEventStream, getQuery } from 'h3'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { accessSync, constants, existsSync, mkdirSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq, asc } from 'drizzle-orm'

const execAsync = promisify(exec)

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

function extractRepoName(url: string): string {
  const match = url.match(/\/([^/]+?)(\.git)?$/)
  return match ? match[1] : 'repo'
}

import { activeProcesses, addStreamToProc, pushToStreams, pendingFeedback } from '~/server/utils/runtime'
import type { ProcState } from '~/server/utils/runtime'

const opencodePath = process.env.OPENCODE_PATH || '/Users/zeinersyad/.opencode/bin/opencode'
const defaultProjectDir = process.env.PROJECT_DIR || process.cwd()
const projectsDir = `${process.env.HOME || '/Users/zeinersyad'}/orbit-projects`

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  // Read and clear pending feedback (posted separately to avoid oversized URL params)
  const feedback = pendingFeedback.get(id) || ''
  pendingFeedback.delete(id)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, title: true, description: true, projectId: true, repositoryId: true },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  let opencodeOk = false
  try {
    accessSync(opencodePath, constants.X_OK)
    opencodeOk = true
  } catch {}

  const stream = createEventStream(event)

  setTimeout(async () => {
    if (!opencodeOk) {
      await stream.push(JSON.stringify({ step: `opencode not found at ${opencodePath}`, timestamp: Date.now() }))
      return
    }

    const existing = activeProcesses.get(id)
    if (existing) {
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

    // ── Helpers for streaming + persistence ──
    const persistLog = async (msg: string) => {
      try {
        await db.insert(schema.activityLogs).values({
          taskId: id,
          userId: user.id,
          action: 'runtime_log',
          newValue: { message: msg },
        })
      } catch {}
    }

    async function pushAndPersist(msg: string) {
      await stream.push(JSON.stringify({ step: msg, timestamp: Date.now() }))
      await persistLog(msg)
    }

    let lineBuffer = ''
    let hasOutput = false
    let lastActivity = Date.now()

    let workDir = defaultProjectDir
    let branchName = ''

    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, task.projectId),
      columns: { workspaceId: true },
    })

    if (project) {
      let repoUrl = ''
      let repoDefaultBranch = 'main'
      let createBranch = false
      let repoName = ''

      if (task.repositoryId) {
        const repo = await db.query.repositories.findFirst({
          where: eq(schema.repositories.id, task.repositoryId),
        })
        if (repo) {
          repoUrl = repo.url
          repoDefaultBranch = repo.defaultBranch || 'main'
          createBranch = repo.createBranch
          repoName = repo.name
        }
      }

      if (!repoUrl && project) {
        const workspaceRepos = await db.query.repositories.findMany({
          where: eq(schema.repositories.workspaceId, project.workspaceId),
          limit: 1,
        })
        if (workspaceRepos[0]) {
          repoUrl = workspaceRepos[0].url
          repoDefaultBranch = workspaceRepos[0].defaultBranch || 'main'
          createBranch = workspaceRepos[0].createBranch
          repoName = workspaceRepos[0].name
        }
      }

      if (repoUrl) {
        repoName = repoName || extractRepoName(repoUrl)
        const cloneDir = `${projectsDir}/${repoName}`

        if (!existsSync(cloneDir)) {
          await pushAndPersist(`Cloning ${repoUrl}...`)
          try {
            mkdirSync(projectsDir, { recursive: true })
            await new Promise<void>((resolve, reject) => {
              const git = spawn('git', ['clone', repoUrl, cloneDir], {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
              })
              git.on('exit', (code) => {
                code === 0 ? resolve() : reject(new Error(`git clone exited with code ${code}`))
              })
              git.on('error', reject)
            })
            await pushAndPersist(`Cloned to ${cloneDir}`)
          } catch (err: any) {
            await pushAndPersist(`Clone failed: ${err.message}`)
          }
        }

        workDir = cloneDir

        if (createBranch) {
          branchName = `task-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)}`
          try {
            await execAsync(`git checkout ${repoDefaultBranch} 2>/dev/null && git pull origin ${repoDefaultBranch} 2>/dev/null`, { cwd: workDir })
            const { stdout: branchCheck } = await execAsync(`git branch --list ${branchName}`, { cwd: workDir })
            if (!branchCheck.trim()) {
              await execAsync(`git checkout -b ${branchName}`, { cwd: workDir })
              await pushAndPersist(`Switched to new branch "${branchName}"`)
            } else {
              await execAsync(`git fetch origin ${branchName} 2>/dev/null`, { cwd: workDir })
              await execAsync(`git checkout ${branchName}`, { cwd: workDir })
              await execAsync(`git reset --hard origin/${branchName} 2>/dev/null || true`, { cwd: workDir })
              await pushAndPersist(`Checked out existing branch "${branchName}"`)
            }
          } catch {}
        }
      }
    }

    await pushAndPersist(`Spawning opencode for "${task.title}" in ${workDir}...`)

    let message = task.description
      ? `${task.title}\n\n${task.description}`
      : task.title

    if (feedback) {
      const feedbackTail = feedback.length > 150 ? feedback.slice(0, 150) + '...' : feedback
      await pushAndPersist(`Including PR feedback: ${feedbackTail}`)
      message = `[PR FEEDBACK TO ADDRESS]\n${feedback}\n\n[ORIGINAL TASK]\n${message}\n\nCRITICAL: The PR feedback above was given by a code reviewer. You MUST examine each item carefully and make the necessary code changes to fix ALL reported issues. Do NOT skip any item. Do NOT assume issues are already resolved — verify by making actual code changes. Your goal is to modify the codebase to satisfy each piece of feedback.`
    }

    const proc = spawn(opencodePath, [
      'run',
      '--format', 'json',
      '--dangerously-skip-permissions',
      '--dir', workDir,
      message,
    ], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    const entry: ProcState = { proc, streams: [], heartbeat: null }
    activeProcesses.set(id, entry)
    addStreamToProc(id, stream, entry)

    const heartbeat = setInterval(async () => {
      const idle = Math.round((Date.now() - lastActivity) / 1000)
      const alive = proc.exitCode === null
      if (!hasOutput) {
        const msg = alive ? `Waiting for opencode (${idle}s)` : `Process exited (code ${proc.exitCode})`
        await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      }
    }, 5000)
    entry.heartbeat = heartbeat

    const parseAndPush = async (line: string) => {
      try {
        const evt = JSON.parse(line)
        const part = evt.part
        let logMsg = ''

        switch (evt.type) {
          case 'step_start':
            logMsg = 'Step started'
            break
          case 'text':
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

        if (logMsg) {
          hasOutput = true
          lastActivity = Date.now()
          await pushToStreams(entry, JSON.stringify({ step: logMsg, timestamp: Date.now() }))
          persistLog(logMsg)
        }
      } catch {}
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
        if (trimmed.startsWith('ERROR') || trimmed.includes('error:')) {
          hasOutput = true
          pushToStreams(entry, JSON.stringify({ step: trimmed.slice(0, 120), timestamp: Date.now() })).catch(() => {})
        }
      }
    })

    proc.on('error', async (err) => {
      clearInterval(heartbeat)
      hasOutput = true
      const msg = `Failed to start opencode: ${err.message}`
      await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      persistLog(msg)
    })

    proc.on('exit', async (code) => {
      clearInterval(heartbeat)

      if (code === 0 && branchName) {
        try {
          const { stdout: status } = await execAsync('git status --porcelain', { cwd: workDir })
          if (status.trim()) {
            await execAsync('git add -A', { cwd: workDir })
            await execAsync(`git commit -m "${task.title.replace(/"/g, '\\"')}"`, { cwd: workDir })
            await execAsync(`git push origin --delete ${branchName} 2>/dev/null; true`, { cwd: workDir })
            await execAsync(`git push -u origin ${branchName} 2>/dev/null || git push --force -u origin ${branchName}`, { cwd: workDir })
            await pushToStreams(entry, JSON.stringify({ step: 'Pushed changes to branch', timestamp: Date.now() }))
          } else {
            await pushToStreams(entry, JSON.stringify({ step: 'No changes to push', timestamp: Date.now() }))
          }
        } catch (err: any) {
          await pushToStreams(entry, JSON.stringify({ step: `Push failed: ${err.message}`, timestamp: Date.now() }))
        }
      }

      const msg = code === 0 ? 'Done' : `Exited with code ${code}`
      await pushToStreams(entry, JSON.stringify({ step: msg, timestamp: Date.now() }))
      persistLog(msg)
      activeProcesses.delete(id)
      for (const s of entry.streams) {
        try { s.close() } catch {}
      }
    })
  }, 10)

  return stream.send()
})
