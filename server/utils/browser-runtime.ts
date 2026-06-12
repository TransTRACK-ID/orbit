import { spawn } from 'child_process'
import type { EventStream } from 'h3'
import { getHostHome } from './paths'
import { startPreview, stopPreview } from './preview-orchestrator'

export type BrowserRunConfig = {
  taskId: string
  workspaceId: string
  repositoryId?: string | null
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
  hostOutputDir?: string
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

  // Ensure preview is running
  let previewInfo: { instanceId: string; url: string }
  try {
    await pushToStream(
      stream,
      JSON.stringify({ step: `Starting preview in ${config.worktreeDir}...`, timestamp: Date.now() }),
    )
    previewInfo = await startPreview(config.taskId, config.repositoryId || undefined, config.worktreeDir)
    // Browser agent shares network namespace with web container, so it can access localhost:3000
    const previewUrl = `http://localhost:3000${previewInfo.url}/`
    await pushToStream(
      stream,
      JSON.stringify({ step: `Preview ready at ${previewUrl}`, timestamp: Date.now() }),
    )
  } catch (err: any) {
    await pushToStream(
      stream,
      JSON.stringify({ step: `Preview failed: ${err.message}`, timestamp: Date.now() }),
    )
    throw err
  }

  const taskText = config.taskDescription
    ? `${config.taskTitle}\n${config.taskDescription}`
    : config.taskTitle

  // The web container communicates with the host Docker daemon via a socket.
  // This means volume mounts must use the HOST machine's paths, not the web container's internal paths.
  let hostOutputDir = config.outputDir
  if (hostOutputDir.startsWith('/root/orbit-projects')) {
    // If running in Docker Desktop on Mac/Windows, the volume was mapped from ~/orbit-projects.
    // However, '~' is not expanded by the docker daemon, so we need an absolute path.
    // Replace container /root paths with the host home when volume mounts use host paths.
    const hostHome = getHostHome()
    hostOutputDir = hostOutputDir.replace('/root/orbit-projects', `${hostHome}/orbit-projects`)
  }

  const dockerArgs: string[] = [
    'run',
    '--rm',
    '-e', `FIREWORKS_API_KEY=${apiKey}`,
    '-e', `FIREWORKS_BASE_URL=https://api.fireworks.ai/inference/v1`,
    '-e', `LLM_MODEL=${process.env.BROWSER_QA_LLM_MODEL || 'accounts/fireworks/routers/kimi-k2p6-turbo'}`,
    '-e', `HEADED=${config.headed}`,
    '-v', `${hostOutputDir}:/output`,
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

  const previewUrl = `http://localhost:3000${previewInfo.url}/`

  dockerArgs.push(
    'orbit/browser-agent:latest',
    '--task', taskText,
    '--base-url', previewUrl,
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
        // Hide LiteLLM internal logs that expose model/provider details
        if (/litellm|LiteLLM/i.test(trimmed)) continue
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

      // Dev server is intentionally NOT stopped here so the preview stays alive.
      // It will be cleaned up on process exit or by an explicit stop later.

      resolve({
        status,
        outputDir: config.outputDir,
        hostOutputDir,
        summary: finalSummary,
      })
    })
  })
}
