import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

export type DevServerInfo = {
  worktreeDir: string
  proc: ReturnType<typeof spawn>
  port: number
  baseUrl: string
  ready: boolean
}

const activeDevServers = new Map<string, DevServerInfo>()

export function getDevServerStatus(worktreeDir: string): DevServerInfo | undefined {
  return activeDevServers.get(worktreeDir)
}

export function getBrowserQueueStatus(): { isRunning: boolean; queued: number; nextJob: string | null } {
  // Re-exported from browser-queue for health endpoint usage
  // We import lazily to avoid circular deps
  const { getQueueStatus } = require('./browser-queue')
  return getQueueStatus()
}

function getAvailablePort(): number {
  // Use a random port in the 9000-9999 range
  return 9000 + Math.floor(Math.random() * 1000)
}

async function waitForPort(port: number, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`, { timeout: 2000 })
      if (stdout.trim() === '200' || stdout.trim() === '404') {
        return true
      }
    } catch {
      // Port not ready yet
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

function detectDevCommand(worktreeDir: string, port: number): { command: string; args: string[]; env: Record<string, string> } | null {
  const packageJsonPath = path.join(worktreeDir, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      const scripts = pkg.scripts || {}
      if (scripts.dev) {
        // Pass port via -- --port for frameworks that support it (Vite, Nuxt, Next)
        return { command: 'npm', args: ['run', 'dev', '--', '--port', String(port)], env: {} }
      }
      if (scripts.start) {
        return { command: 'npm', args: ['run', 'start', '--', '--port', String(port)], env: {} }
      }
      if (scripts.serve) {
        return { command: 'npm', args: ['run', 'serve', '--', '--port', String(port)], env: {} }
      }
    } catch {
      // ignore parse errors
    }
  }

  // Laravel
  if (existsSync(path.join(worktreeDir, 'artisan'))) {
    return { command: 'php', args: ['artisan', 'serve', `--port=${port}`], env: {} }
  }

  // Django
  if (existsSync(path.join(worktreeDir, 'manage.py'))) {
    return { command: 'python', args: ['manage.py', 'runserver', `127.0.0.1:${port}`], env: {} }
  }

  // Vite project without package.json scripts (rare)
  if (existsSync(path.join(worktreeDir, 'vite.config.ts')) || existsSync(path.join(worktreeDir, 'vite.config.js'))) {
    return { command: 'npx', args: ['vite', '--port', String(port)], env: {} }
  }

  return null
}

export async function startDevServer(worktreeDir: string): Promise<DevServerInfo> {
  const existing = activeDevServers.get(worktreeDir)
  if (existing && existing.ready) {
    return existing
  }

  const port = getAvailablePort()
  const baseUrl = `http://localhost:${port}`

  const devCmd = detectDevCommand(worktreeDir, port)
  if (!devCmd) {
    throw new Error(`No dev command detected in ${worktreeDir}. Ensure package.json with a "dev" script exists.`)
  }

  const env = {
    ...process.env,
    PORT: String(port),
    NUXT_PORT: String(port),
    VITE_PORT: String(port),
    NEXT_PORT: String(port),
    ...devCmd.env,
  }

  const proc = spawn(devCmd.command, devCmd.args, {
    cwd: worktreeDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env,
  })

  const info: DevServerInfo = {
    worktreeDir,
    proc,
    port,
    baseUrl,
    ready: false,
  }

  activeDevServers.set(worktreeDir, info)

  // Log dev server output for debugging
  proc.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim()
    if (text) {
      console.log(`[dev-server ${worktreeDir}] ${text.slice(0, 200)}`)
    }
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim()
    if (text) {
      console.error(`[dev-server ${worktreeDir}] ${text.slice(0, 200)}`)
    }
  })

  proc.on('exit', (code) => {
    console.log(`[dev-server] ${worktreeDir} exited with code ${code}`)
    activeDevServers.delete(worktreeDir)
  })

  proc.on('error', (err) => {
    console.error(`[dev-server] ${worktreeDir} error: ${err.message}`)
    activeDevServers.delete(worktreeDir)
  })

  const ready = await waitForPort(port, 30000)
  if (!ready) {
    try { proc.kill('SIGTERM') } catch {}
    activeDevServers.delete(worktreeDir)
    throw new Error(`Dev server failed to start on port ${port} within 30s`)
  }

  info.ready = true
  console.log(`[dev-server] Ready at ${baseUrl} for ${worktreeDir}`)
  return info
}

export function stopDevServer(worktreeDir: string): void {
  const info = activeDevServers.get(worktreeDir)
  if (info) {
    try {
      info.proc.kill('SIGTERM')
      setTimeout(() => {
        try { info.proc.kill('SIGKILL') } catch {}
      }, 5000)
    } catch {}
    activeDevServers.delete(worktreeDir)
  }
}

export function stopAllDevServers(): void {
  for (const [worktreeDir] of activeDevServers) {
    stopDevServer(worktreeDir)
  }
}

// Cleanup on process exit
process.on('exit', stopAllDevServers)
process.on('SIGINT', stopAllDevServers)
process.on('SIGTERM', stopAllDevServers)
