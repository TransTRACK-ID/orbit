import { spawn, exec, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { accessSync, constants } from 'fs'
import { getDefaultAgentRuntime, resolveEffectiveRuntime } from '~/server/utils/agent-runtime-config'
import { isCursorInstalled, spawnCursorAgent } from '~/server/utils/cursor-agent'
import { processOpencodeLine } from '~/server/utils/opencode-parser'
import { getOpencodePath } from '~/server/utils/paths'

const execAsync = promisify(exec)

export function getAgentRuntimeLabel(runtime: string): string {
  return runtime === 'cursor' ? 'cursor-agent' : 'opencode'
}

export async function resolveAppAgentRuntime(requested?: string | null): Promise<string> {
  return resolveEffectiveRuntime(requested || getDefaultAgentRuntime())
}

export async function checkAgentRuntimeAvailability(runtime: string): Promise<{
  ok: boolean
  version?: string
  error?: string
}> {
  if (runtime === 'cursor') {
    const installed = await isCursorInstalled()
    if (!installed) {
      return { ok: false, error: 'cursor-agent is not installed or not on PATH' }
    }
    try {
      const { stdout } = await execAsync('cursor-agent --version', { timeout: 5000 })
      return { ok: true, version: stdout.trim() }
    } catch (err: any) {
      return { ok: true, version: `version check failed: ${err.message}` }
    }
  }

  const opencodePath = getOpencodePath()
  try {
    accessSync(opencodePath, constants.X_OK)
  } catch {
    return { ok: false, error: `opencode not found at ${opencodePath}` }
  }

  try {
    const { stdout } = await execAsync(`"${opencodePath}" --version`, { timeout: 5000 })
    return { ok: true, version: stdout.trim() }
  } catch (err: any) {
    return { ok: true, version: `version check failed: ${err.message}` }
  }
}

export interface AgentOutputAccumulator {
  rawOutput: { value: string }
  stderrOutput: { value: string }
  debugLog: { eventTypes: string[]; rawLines: string[] }
}

export function createAgentOutputAccumulator(): AgentOutputAccumulator {
  return {
    rawOutput: { value: '' },
    stderrOutput: { value: '' },
    debugLog: { eventTypes: [], rawLines: [] },
  }
}

export interface SpawnAgentPromptOptions {
  runtime: string
  prompt: string
  workDir: string
  env?: NodeJS.ProcessEnv
  filePaths?: string[]
  onText?: (delta: string, accumulated: string) => void
  onActivity?: (activity: string) => void
}

export interface SpawnAgentPromptResult {
  proc: ChildProcess
  runtime: string
  runtimeLabel: string
  accumulator: AgentOutputAccumulator
  stdoutEnded: { value: boolean }
  lastActivity: { value: number }
  lineBuffer: { value: string }
  flushLineBuffer: () => void
}

function appendFilePathsToPrompt(prompt: string, filePaths: string[]): string {
  if (filePaths.length === 0) return prompt
  return `${prompt}\n\n[ATTACHED FILES]\nThe following files are attached and available for analysis:\n${filePaths.map(p => `- ${p}`).join('\n')}`
}

export async function spawnAgentPromptProcess(
  options: SpawnAgentPromptOptions,
): Promise<SpawnAgentPromptResult> {
  const {
    runtime,
    prompt,
    workDir,
    env = { ...process.env },
    filePaths = [],
    onText,
    onActivity,
  } = options

  const runtimeLabel = getAgentRuntimeLabel(runtime)
  const accumulator = createAgentOutputAccumulator()
  const stdoutEnded = { value: false }
  const lastActivity = { value: Date.now() }
  const lineBuffer = { value: '' }

  const flushLineBuffer = () => {
    if (lineBuffer.value.trim()) {
      processOpencodeLine(lineBuffer.value, accumulator.rawOutput, accumulator.debugLog)
      lineBuffer.value = ''
    }
  }

  if (runtime === 'cursor') {
    const finalPrompt = appendFilePathsToPrompt(prompt, filePaths)
    const cursorRun = await spawnCursorAgent(finalPrompt, {
      workdir: workDir,
      onText: (delta, accumulated) => {
        lastActivity.value = Date.now()
        accumulator.rawOutput.value = accumulated
        onText?.(delta, accumulated)
      },
      onActivity: (activity) => {
        lastActivity.value = Date.now()
        onActivity?.(activity)
      },
      onStderr: (text) => {
        lastActivity.value = Date.now()
        accumulator.stderrOutput.value += text
      },
    })

    const proc = cursorRun.proc
    proc.stdout?.on('end', () => {
      stdoutEnded.value = true
    })

    return {
      proc,
      runtime,
      runtimeLabel,
      accumulator,
      stdoutEnded,
      lastActivity,
      lineBuffer,
      flushLineBuffer,
    }
  }

  const opencodePath = getOpencodePath()
  const spawnArgs = [
    'run',
    '--format', 'json',
    '--dangerously-skip-permissions',
    '--dir', workDir,
  ]

  for (const filePath of filePaths) {
    spawnArgs.push('--file', filePath)
  }
  spawnArgs.push('--', prompt)

  const proc = spawn(opencodePath, spawnArgs, {
    cwd: workDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env,
  })

  proc.stdout?.on('data', (chunk: Buffer) => {
    lastActivity.value = Date.now()
    lineBuffer.value += chunk.toString()
    const lines = lineBuffer.value.split('\n')
    lineBuffer.value = lines.pop() || ''
    for (const line of lines) {
      processOpencodeLine(line, accumulator.rawOutput, accumulator.debugLog)
    }
  })

  proc.stdout?.on('end', () => {
    stdoutEnded.value = true
    flushLineBuffer()
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    lastActivity.value = Date.now()
    const text = chunk.toString()
    if (text) {
      accumulator.stderrOutput.value += text
    }
  })

  return {
    proc,
    runtime,
    runtimeLabel,
    accumulator,
    stdoutEnded,
    lastActivity,
    lineBuffer,
    flushLineBuffer,
  }
}
