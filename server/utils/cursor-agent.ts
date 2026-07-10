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
  /** Called when a tool call completes (cursor stream-json only). */
  onToolResult?: (tool: string, args: Record<string, unknown>, result: unknown) => void
  /** Called with stderr output from the cursor process. */
  onStderr?: (text: string) => void
}

type CursorStreamEvent = Record<string, unknown>

export function extractCursorToolUse(ev: CursorStreamEvent): { tool: string; args: Record<string, unknown> } | null {
  if (ev.type === 'tool_use') {
    const tool = typeof ev.tool === 'string' ? ev.tool : 'tool'
    const args = (ev.args && typeof ev.args === 'object' ? ev.args : {}) as Record<string, unknown>
    return { tool, args }
  }

  if (ev.type !== 'tool_call') return null
  if (ev.subtype !== 'started' && ev.subtype !== 'completed') return null

  const toolCall = ev.tool_call as Record<string, unknown> | undefined
  if (!toolCall) return null

  const mcp = toolCall.mcpToolCall as Record<string, unknown> | undefined
  if (mcp) {
    const mcpArgs = mcp.args as Record<string, unknown> | undefined
    if (!mcpArgs) return null
    const toolName = String(
      mcpArgs.name
      || (mcpArgs.serverIdentifier && mcpArgs.toolName
        ? `${mcpArgs.serverIdentifier}-${mcpArgs.toolName}`
        : '')
      || mcpArgs.toolName
      || 'mcp-tool',
    )
    const args = (mcpArgs.args && typeof mcpArgs.args === 'object'
      ? mcpArgs.args
      : {}) as Record<string, unknown>
    return { tool: toolName, args }
  }

  const shell = toolCall.shellToolCall as Record<string, unknown> | undefined
  if (shell) {
    const shellArgs = shell.args as Record<string, unknown> | undefined
    return { tool: 'bash', args: { command: shellArgs?.command || '' } }
  }

  const edit = toolCall.editToolCall as Record<string, unknown> | undefined
  if (edit) {
    const editArgs = edit.args as Record<string, unknown> | undefined
    return { tool: 'edit', args: editArgs || {} }
  }

  const write = toolCall.writeToolCall as Record<string, unknown> | undefined
  if (write) {
    const writeArgs = write.args as Record<string, unknown> | undefined
    return { tool: 'write', args: writeArgs || {} }
  }

  return null
}

export function extractCursorToolResult(ev: CursorStreamEvent): { tool: string; args: Record<string, unknown>; result: unknown } | null {
  if (ev.type !== 'tool_call' || ev.subtype !== 'completed') return null
  const toolUse = extractCursorToolUse(ev)
  if (!toolUse) return null

  const toolCall = ev.tool_call as Record<string, unknown> | undefined
  const mcp = toolCall?.mcpToolCall as Record<string, unknown> | undefined
  const result = mcp?.result ?? toolCall?.result ?? ev.result

  return { ...toolUse, result }
}

function appendAssistantText(ev: CursorStreamEvent, onAppend: (text: string) => void) {
  if (ev.type === 'assistant') {
    const message = ev.message as { content?: Array<{ type?: string; text?: string }> } | undefined
    const text = message?.content
      ?.filter(part => part.type === 'text' && part.text)
      .map(part => part.text)
      .join('') || ''
    if (text) onAppend(text)
    return
  }

  if (ev.type === 'result' && typeof ev.result === 'string' && ev.result) {
    onAppend(ev.result)
  }
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
  options: AnalyzeOptions & { model?: string } = {},
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
    onToolResult,
    onStderr,
    model: optModel,
  } = options
  const model = optModel || getCursorModel()

  const installed = await isCursorInstalled()
  if (!installed) {
    throw new Error(
      'cursor-agent is not installed on this server. '
      + 'Install it with: npm install -g cursor-agent, '
      + 'then authenticate with: cursor-agent login (or set CURSOR_API_KEY env var).',
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
  let resultLocked = false
  const proc = spawn(getCursorPath(), args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: workdir || process.cwd(),
    env: { ...process.env },
  })

  onDebugEvent?.({ type: 'cursor.spawn', payload: { args, pid: proc.pid ?? null } })

  const stderrBuf: string[] = []
  let buffer = ''
  let exitCode: number | null = null
  let stdoutEnded = false

  function appendText(text: string, replace = false) {
    if (!text) return
    if (resultLocked && !replace) return
    accumulated = replace ? text : accumulated + text
    onText?.(replace ? '' : text, accumulated)
  }

  function applyFinalResult(text: string) {
    if (!text.trim()) return
    resultLocked = true
    accumulated = text.trim()
    onText?.('', accumulated)
  }

  function processEvent(ev: CursorStreamEvent) {
    onDebugEvent?.({ type: `cursor.${String(ev.type)}`, payload: ev })

    if (ev.type === 'result') {
      const resultText = typeof ev.result === 'string'
        ? ev.result
        : (() => {
            const message = ev.message as { content?: Array<{ type?: string; text?: string }> } | undefined
            return message?.content
              ?.filter(part => part.type === 'text' && part.text)
              .map(part => part.text)
              .join('') || ''
          })()
      if (resultText.trim()) {
        applyFinalResult(resultText)
      }

      const tokens = ev.tokens as { input: number; output: number } | undefined
      if (tokens) onTokens?.(tokens)

      const toolUse = extractCursorToolUse(ev)
      if (toolUse) {
        const argSummary = Object.entries(toolUse.args)
          .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
          .join(', ')
        onActivity?.(`Tool: ${toolUse.tool}(${argSummary})`)
        onToolUse?.(toolUse.tool, toolUse.args)
      }
      return
    }

    if (resultLocked) {
      const toolUse = extractCursorToolUse(ev)
      if (toolUse) {
        const argSummary = Object.entries(toolUse.args)
          .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
          .join(', ')
        onActivity?.(`Tool: ${toolUse.tool}(${argSummary})`)
        if (ev.subtype === 'completed') {
          const toolResult = extractCursorToolResult(ev)
          if (toolResult) {
            onToolResult?.(toolResult.tool, toolResult.args, toolResult.result)
          }
        } else {
          onToolUse?.(toolUse.tool, toolUse.args)
        }
      }
      return
    }

    if (typeof ev.result === 'string' && ev.result && ev.type !== 'result') {
      appendText(ev.result, true)
    }
    if (typeof ev.delta === 'string' && ev.delta) {
      appendText(ev.delta)
    }
    if (typeof ev.message === 'string' && ev.message && ev.type !== 'assistant') {
      appendText(ev.message)
    }

    const tokens = ev.tokens as { input: number; output: number } | undefined
    if (tokens) {
      onTokens?.(tokens)
    }

    // With --stream-partial-output, ev.delta carries assistant text incrementally.
    // Appending full assistant payloads here duplicates streamed content (2–3×).

    const toolUse = extractCursorToolUse(ev)
    if (toolUse) {
      const argSummary = Object.entries(toolUse.args)
        .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
        .join(', ')
      onActivity?.(`Tool: ${toolUse.tool}(${argSummary})`)
      if (ev.subtype === 'completed') {
        const toolResult = extractCursorToolResult(ev)
        if (toolResult) {
          onToolResult?.(toolResult.tool, toolResult.args, toolResult.result)
        }
      } else {
        onToolUse?.(toolUse.tool, toolUse.args)
      }
    }

    if (ev.type === 'error') {
      const msg = String(ev.message || ev.error || 'Cursor agent error')
      onDebugEvent?.({ type: 'cursor.error', payload: { message: msg } })
    }
  }

  function flushBuffer() {
    if (!buffer.trim()) return
    const lines = buffer.split('\n')
    buffer = ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line) as CursorStreamEvent
        processEvent(ev)
      } catch {
        onDebugEvent?.({ type: 'cursor.raw', payload: { line } })
        appendText(`${line}\n`)
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
        const ev = JSON.parse(line) as CursorStreamEvent
        processEvent(ev)
      } catch {
        onDebugEvent?.({ type: 'cursor.raw', payload: { line } })
        appendText(`${line}\n`)
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
