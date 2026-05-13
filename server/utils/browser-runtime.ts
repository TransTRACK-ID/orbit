import { spawn } from 'child_process'
import type { EventStream } from 'h3'
import type { DevServerInfo } from './dev-server-orchestrator'
import { startDevServer, stopDevServer } from './dev-server-orchestrator'

export type BrowserRunConfig = {
  taskId: string
  workspaceId: string
  agentId: string
  worktreeDir: string
  taskTitle: string
  taskDescription?: string | null
  headed: boolean
  outputDir: string
  maxRuntimeMs: number
}

export type BrowserContainerResult = {
  status: 'passed' | 'failed'
  outputDir: string
  summary?: string
  error?: string
}

async function pushToStream(stream: EventStream, data: string) {
  try {
    await stream.push(data)
  } catch {
    // stream may be closed
  }
}

function getApiKeyFromEnv(): string | undefined {
  return process.env.FIREWORKS_API_KEY
    || process.env.OPENAI_API_KEY
    || undefined
}

function getApiKeyFromOpencodeConfig(): string | undefined {
  try {
    const { readFileSync } = require('fs')
    const configPath = `${process.env.HOME || '/root'}/.config/opencode/opencode.json`
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    return config?.provider?.firepass?.options?.apiKey
      || config?.provider?.fireworks?.options?.apiKey
      || undefined
  } catch {
    return undefined
  }
}

export async function runBrowserContainer(
  config: BrowserRunConfig,
  stream: EventStream,
): Promise<BrowserContainerResult> {
  const apiKey = getApiKeyFromEnv() || getApiKeyFromOpencodeConfig()

  if (!apiKey) {
    throw new Error(
      'No Fireworks API key found. Set FIREWORKS_API_KEY or OPENAI_API_KEY environment variable.',
    )
  }

  // Ensure dev server is running
  let devServer: DevServerInfo
  try {
    await pushToStream(
      stream,
      JSON.stringify({ step: `Starting dev server in ${config.worktreeDir}...`, timestamp: Date.now() }),
    )
    devServer = await startDevServer(config.worktreeDir)
    await pushToStream(
      stream,
      JSON.stringify({ step: `Dev server ready at ${devServer.baseUrl}`, timestamp: Date.now() }),
    )
  } catch (err: any) {
    await pushToStream(
      stream,
      JSON.stringify({ step: `Dev server failed: ${err.message}`, timestamp: Date.now() }),
    )
    throw err
  }

  const taskText = config.taskDescription
    ? `${config.taskTitle}\n${config.taskDescription}`
    : config.taskTitle

  const dockerArgs: string[] = [
    'run',
    '--rm',
    '-e', `FIREWORKS_API_KEY=${apiKey}`,
    '-e', `FIREWORKS_BASE_URL=https://api.fireworks.ai/inference/v1`,
    '-e', `LLM_MODEL=accounts/fireworks/routers/kimi-k2p6-turbo`,
    '-e', `HEADED=${config.headed}`,
    '-v', `${config.outputDir}:/output`,
  ]

  if (process.env.WEB_CONTAINER_NAME) {
    dockerArgs.push('--network', `container:${process.env.WEB_CONTAINER_NAME}`)
  } else {
    dockerArgs.push('--network', 'host')
  }

  if (config.headed) {
    // Expose VNC port when in headed mode
    // (Queue ensures only one container runs at a time, so 5900 is safe)
    dockerArgs.push('-p', '5900:5900')
  }

  dockerArgs.push(
    'orbit/browser-agent:latest',
    '--task', taskText,
    '--base-url', devServer.baseUrl,
    '--output-dir', '/output',
    '--headless', String(!config.headed),
  )

  await pushToStream(
    stream,
    JSON.stringify({ step: `Spawning browser container: docker ${dockerArgs.join(' ')}`, timestamp: Date.now() }),
  )

  return new Promise((resolve, reject) => {
    const proc = spawn('docker', dockerArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    let lineBuffer = ''
    let lastActivity = Date.now()
    let hasOutput = false
    let finalSummary = ''

    const runtimeTimeout = setTimeout(() => {
      if (proc.exitCode === null) {
        const msg = `Browser runtime timeout reached (${config.maxRuntimeMs / 60000} min) — terminating container`
        pushToStream(stream, JSON.stringify({ step: msg, timestamp: Date.now() })).catch(() => {})
        try { proc.kill('SIGTERM') } catch {}
        setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 5000)
      }
    }, config.maxRuntimeMs)

    const heartbeat = setInterval(async () => {
      const idle = Math.round((Date.now() - lastActivity) / 1000)
      const alive = proc.exitCode === null
      if (!hasOutput || idle > 30) {
        const msg = alive
          ? `Waiting for browser agent (${idle}s)`
          : `Browser container exited (code ${proc.exitCode})`
        await pushToStream(stream, JSON.stringify({ step: msg, timestamp: Date.now() }))
      }
    }, 5000)

    proc.stdout?.on('data', (chunk: Buffer) => {
      lastActivity = Date.now()
      lineBuffer += chunk.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        hasOutput = true
        try {
          const evt = JSON.parse(trimmed)
          const msg = evt.message || evt.summary || JSON.stringify(evt)
          if (evt.type === 'complete' && evt.summary) {
            finalSummary = evt.summary
          }
          pushToStream(stream, JSON.stringify({ step: msg, timestamp: Date.now() })).catch(() => {})
        } catch {
          // Not JSON — forward raw
          pushToStream(stream, JSON.stringify({ step: trimmed.slice(0, 200), timestamp: Date.now() })).catch(() => {})
        }
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
        const level = trimmed.toLowerCase().includes('error') ? 'ERROR' : 'WARN'
        pushToStream(stream, JSON.stringify({ step: `[${level}] ${trimmed.slice(0, 200)}`, timestamp: Date.now() })).catch(() => {})
      }
    })

    proc.on('error', async (err) => {
      clearInterval(heartbeat)
      clearTimeout(runtimeTimeout)
      await pushToStream(stream, JSON.stringify({ step: `Docker spawn error: ${err.message}`, timestamp: Date.now() }))
      reject(err)
    })

    proc.on('exit', async (code) => {
      clearInterval(heartbeat)
      clearTimeout(runtimeTimeout)

      const status = code === 0 ? 'passed' : 'failed'
      const msg = code === 0 ? 'Browser QA completed' : `Browser QA failed (exit code ${code})`
      await pushToStream(stream, JSON.stringify({ step: msg, timestamp: Date.now() }))

      // Clean up dev server
      stopDevServer(config.worktreeDir)

      resolve({
        status,
        outputDir: config.outputDir,
        summary: finalSummary,
      })
    })
  })
}
