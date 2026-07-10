import { spawn, type ChildProcess } from 'child_process'
import { readFileSync, existsSync } from 'fs'

export interface AnalyzeOptions {
  /** Working directory for the Cursor session. */
  workdir?: string
  /** Trust the workspace (skip trust prompts; helps MCP load in headless runs). */
  trustWorkspace?: boolean
  /** Prepend OpenCode AGENTS.md system instructions (disable for browser-only QA runs). */
  includeAgentsMd?: boolean
  /** Abort the run early. */
  signal?: AbortSignal
  /** Called whenever a chunk of assistant text arrives. */
  onText?: (delta: string, accumulated: string) => void
  /** Called when the agent's activity changes (tool use, thinking, etc.). */
  onActivity?: (activity: string) => void
  /** Called when the agent reports token usage (not always provided by cursor-agent). */
  onTokens?: (tokens: { input: number; output: number }) => void
  /** Called with every raw cursor event for deep debugging. */
  onDebugEvent?: (event: { type: string; payload: Record<string, unknown> }) => void
  /** Called when the agent uses a tool. */
  onToolUse?: (tool: string, args: Record<string, unknown>) => void
  /** Called with stderr output from the cursor process. */
  onStderr?: (text: string) => void
}

interface CursorEvent {
  type: string
  chatId?: string
  delta?: string
  result?: string
  tool?: string
  args?: Record<string, unknown>
  error?: string
  message?: string
  tokens?: { input: number; output: number }
}

export function getCursorPath(): string {
  return process.env.CURSOR_AGENT_PATH || 'cursor-agent'
}

export function getCursorModel(): string {
  return process.env.CURSOR_MODEL || 'auto'
}

export async function isCursorInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(getCursorPath(), ['--version'], { stdio: 'ignore' })
    proc.on('error', () => resolve(false))
    proc.on('exit', (code) => resolve(code === 0))
  })
}

export async function isCursorAuthenticated(): Promise<{
  ok: boolean
  method: 'login' | 'api_key' | 'none'
  error?: string
}> {
  if (process.env.CURSOR_API_KEY) {
    return { ok: true, method: 'api_key' }
  }

  const installed = await isCursorInstalled()
  if (!installed) {
    return { ok: false, method: 'none', error: 'cursor-agent is not installed' }
  }

  return new Promise((resolve) => {
    const proc = spawn(getCursorPath(), ['whoami'], { stdio: 'pipe' })
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })

    proc.on('exit', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve({ ok: true, method: 'login' })
      } else {
        const err = stderr.trim() || stdout.trim() || 'Not authenticated'
        resolve({ ok: false, method: 'none', error: err })
      }
    })

    proc.on('error', () => {
      resolve({ ok: false, method: 'none', error: 'Failed to run cursor-agent whoami' })
    })
  })
}

export interface CursorRun {
  proc: ChildProcess
  promise: Promise<string>
}

export async function spawnCursorAgent(
  prompt: string,
  options: AnalyzeOptions & { model?: string } = {}
): Promise<CursorRun> {
  const {
    workdir,
    trustWorkspace,
    includeAgentsMd = true,
    signal,
    onText,
    onActivity,
    onTokens,
    onDebugEvent,
    onToolUse,
    onStderr,
    model: optModel,
  } = options
  const model = optModel || getCursorModel()

  const installed = await isCursorInstalled()
  if (!installed) {
    throw new Error(
      'cursor-agent is not installed on this server. ' +
      'Install it with: npm install -g cursor-agent, ' +
      'then authenticate with: cursor-agent login (or set CURSOR_API_KEY env var).'
    )
  }

  const args = [
  // Headless mode — required for --trust and reliable MCP tool injection in CI/Docker.
    '-p',
    '--force',
    '--approve-mcps',
    '--output-format', 'stream-json',
    '--stream-partial-output',
  ]

  if (trustWorkspace) {
    args.push('--trust')
  }

  if (model && model !== 'auto') {
    args.push('--model', model)
  }

  if (workdir) {
    args.push('--workspace', workdir)
  }

  // Cursor CLI does not natively read AGENTS.md (OpenCode's instructions file).
  // It uses .cursorrules / .cursor/rules/*.mdc instead. To keep behavior aligned
  // with the existing agent instructions, read AGENTS.md from the same path
  // used by OpenCode and prepend it to the prompt as system instructions.
  const agentsMdPath = process.env.CURSOR_AGENTS_MD_PATH || process.env.AGENTS_MD_PATH || '/root/.config/opencode/AGENTS.md'
  let finalPrompt = prompt
  if (includeAgentsMd) {
    try {
      if (existsSync(agentsMdPath)) {
        const agentsMd = readFileSync(agentsMdPath, 'utf-8')
        if (agentsMd.trim()) {
          finalPrompt = `[SYSTEM INSTRUCTIONS]\n${agentsMd.trim()}\n\n[USER REQUEST]\n${prompt}`
        }
      }
    } catch {
      // Non-fatal: if reading AGENTS.md fails, continue with the raw prompt.
    }
  }

  args.push(finalPrompt)

  let accumulated = ''
  let chatId: string | undefined
  const proc = spawn(getCursorPath(), args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: workdir || process.cwd(),
    env: { ...process.env },
  })

  onDebugEvent?.({ type: 'cursor.spawn', payload: { args, pid: proc.pid } })

  const stderrBuf: string[] = []
  let buffer = ''
  let exitCode: number | null = null
  let stdoutEnded = false

  function processEvent(ev: CursorEvent) {
    onDebugEvent?.({ type: `cursor.${ev.type}`, payload: ev as Record<string, unknown> })

    if (typeof ev.result === 'string' && ev.result) {
      accumulated = ev.result
      onText?.('', accumulated)
    }
    if (typeof ev.delta === 'string' && ev.delta) {
      accumulated += ev.delta
      onText?.(ev.delta, accumulated)
    }
    if (typeof ev.message === 'string' && ev.message) {
      accumulated += ev.message
      onText?.(ev.message, accumulated)
    }
    if (ev.tokens) {
      onTokens?.(ev.tokens)
    }

    switch (ev.type) {
      case 'start': {
        chatId = ev.chatId
        break
      }
      case 'content': {
        // delta handled above
        break
      }
      case 'tool_use': {
        const toolName = ev.tool || 'tool'
        const toolArgs = ev.args || {}
        const argSummary = Object.entries(toolArgs)
          .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
          .join(', ')
        onActivity?.(`Tool: ${toolName}(${argSummary})`)
        onToolUse?.(toolName, toolArgs)
        break
      }
      case 'end':
      case 'complete':
      case 'finished': {
        // Final result may be in ev.result (handled above)
        break
      }
      case 'error': {
        const msg = ev.message || ev.error || 'Cursor agent error'
        onDebugEvent?.({ type: 'cursor.error', payload: { message: msg } })
        break
      }
      default: {
        onDebugEvent?.({ type: 'cursor.unhandled', payload: { type: ev.type, keys: Object.keys(ev) } })
      }
    }
  }

  function flushBuffer() {
    if (!buffer.trim()) return
    const lines = buffer.split('\n')
    buffer = ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line) as CursorEvent
        processEvent(ev)
      } catch {
        onDebugEvent?.({ type: 'cursor.raw', payload: { line } })
        accumulated += line + '\n'
        onText?.(line + '\n', accumulated)
      }
    }
  }

  proc.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf-8')
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line) as CursorEvent
        processEvent(ev)
      } catch {
        onDebugEvent?.({ type: 'cursor.raw', payload: { line } })
        accumulated += line + '\n'
        onText?.(line + '\n', accumulated)
      }
    }
  })

  proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      stderrBuf.push(text)
      onStderr?.(text)
      onDebugEvent?.({ type: 'cursor.stderr', payload: { text } })
    })

  const promise = new Promise<string>((resolve, reject) => {
    function checkDone() {
      if (exitCode === null || !stdoutEnded) return

      if (signal?.aborted) {
        reject(new Error('Generation cancelled'))
        return
      }
      if (exitCode !== 0) {
        const stderr = stderrBuf.join('').trim()
        const hint = stderr.includes('auth')
          ? " (Hint: run 'cursor-agent login' to authenticate or set CURSOR_API_KEY)"
          : ''
        reject(new Error(`Cursor agent exited with code ${exitCode}${hint}. ${stderr.slice(0, 500)}`))
      } else {
        resolve(accumulated)
      }
    }

    proc.stdout.on('end', () => {
      stdoutEnded = true
      flushBuffer()
      checkDone()
    })

    proc.on('error', (err) => {
      reject(new Error(`Cursor agent failed to start: ${err.message}`))
    })

    proc.on('exit', (code) => {
      exitCode = code ?? null
      checkDone()
    })

    if (signal) {
      const onAbort = () => {
        proc.kill('SIGTERM')
        setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL')
        }, 5000)
      }
      if (signal.aborted) {
        onAbort()
      } else {
        signal.addEventListener('abort', onAbort, { once: true })
      }
    }
  })

  return { proc, promise }
}

export function createCursorAgent(opts: { model?: string } = {}) {
  const model = opts.model || getCursorModel()

  return {
    async analyze(prompt: string, options: AnalyzeOptions = {}): Promise<string> {
      const run = await spawnCursorAgent(prompt, { ...options, model })
      return run.promise
    },
  }
}

export type CursorAgent = ReturnType<typeof createCursorAgent>
