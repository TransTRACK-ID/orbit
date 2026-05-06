import { createEventStream } from 'h3'
import { spawn } from 'child_process'
import { accessSync, constants, existsSync, mkdirSync } from 'fs'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

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

const opencodePath = process.env.OPENCODE_PATH || '/Users/zeinersyad/.opencode/bin/opencode'
const defaultProjectDir = process.env.PROJECT_DIR || process.cwd()
const projectsDir = `${process.env.HOME || '/Users/zeinersyad'}/orbit-projects`

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event)
  const user = await requireAuth(event)

  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    columns: { id: true, title: true, description: true, projectId: true },
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

    let workDir = defaultProjectDir

    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, task.projectId),
      columns: { workspaceId: true },
    })

    if (project) {
      const workspace = await db.query.workspaces.findFirst({
        where: eq(schema.workspaces.id, project.workspaceId),
        columns: { repositoryUrl: true, defaultBranch: true, name: true },
      })

      if (workspace?.repositoryUrl) {
        const repoName = workspace.name || extractRepoName(workspace.repositoryUrl)
        const cloneDir = `${projectsDir}/${repoName}`

        if (!existsSync(cloneDir)) {
          await stream.push(JSON.stringify({ step: `Cloning ${workspace.repositoryUrl}...`, timestamp: Date.now() }))
          try {
            mkdirSync(projectsDir, { recursive: true })
            await new Promise<void>((resolve, reject) => {
              const git = spawn('git', ['clone', workspace!.repositoryUrl, cloneDir], {
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
            await stream.push(JSON.stringify({ step: `Clone failed: ${err.message}. Falling back to default directory.`, timestamp: Date.now() }))
          }
        }

        workDir = cloneDir
      }
    }

    await stream.push(JSON.stringify({ step: `Spawning opencode for "${task.title}" in ${workDir}...`, timestamp: Date.now() }))

    const message = task.description
      ? `${task.title}\n\n${task.description}`
      : task.title

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

    let lineBuffer = ''
    let hasOutput = false
    let lastActivity = Date.now()

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

    const heartbeat = setInterval(async () => {
      const idle = Math.round((Date.now() - lastActivity) / 1000)
      const alive = proc.exitCode === null
      if (!hasOutput) {
        const msg = alive ? `Waiting for opencode (${idle}s)` : `Process exited (code ${proc.exitCode})`
        await stream.push(JSON.stringify({ step: msg, timestamp: Date.now() }))
      }
    }, 5000)

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
          await stream.push(JSON.stringify({ step: logMsg, timestamp: Date.now() }))
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
          stream.push(JSON.stringify({ step: trimmed.slice(0, 120), timestamp: Date.now() })).catch(() => {})
        }
      }
    })

    proc.on('error', async (err) => {
      clearInterval(heartbeat)
      hasOutput = true
      const msg = `Failed to start opencode: ${err.message}`
      await stream.push(JSON.stringify({ step: msg, timestamp: Date.now() }))
      persistLog(msg)
    })

    proc.on('exit', async (code) => {
      clearInterval(heartbeat)
      const msg = code === 0 ? 'Done' : `Exited with code ${code}`
      await stream.push(JSON.stringify({ step: msg, timestamp: Date.now() }))
      persistLog(msg)
      stream.close()
    })

    stream.onClosed = () => {
      clearInterval(heartbeat)
      try { proc.kill('SIGTERM') } catch {}
      setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
    }
  }, 10)

  return stream.send()
})
