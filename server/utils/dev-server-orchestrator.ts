import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync, rmSync } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

export type DevServerInfo = {
  worktreeDir: string
  proc: ReturnType<typeof spawn>
  port: number
  baseUrl: string
  ready: boolean
  installedDeps: boolean
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

function detectPackageManager(worktreeDir: string): { cmd: string; args: string[] } | null {
  if (existsSync(path.join(worktreeDir, 'pnpm-lock.yaml'))) {
    return { cmd: 'pnpm', args: ['install'] }
  }
  if (existsSync(path.join(worktreeDir, 'yarn.lock'))) {
    return { cmd: 'yarn', args: ['install'] }
  }
  if (existsSync(path.join(worktreeDir, 'bun.lockb'))) {
    return { cmd: 'bun', args: ['install'] }
  }
  if (existsSync(path.join(worktreeDir, 'package-lock.json')) || existsSync(path.join(worktreeDir, 'package.json'))) {
    return { cmd: 'npm', args: ['install'] }
  }
  return null
}

async function installDependencies(worktreeDir: string): Promise<boolean> {
  const nodeModulesPath = path.join(worktreeDir, 'node_modules')
  const nuxtBinPath = path.join(worktreeDir, 'node_modules', '.bin', 'nuxt')

  // Check if node_modules exists AND has the nuxt binary
  if (existsSync(nodeModulesPath) && existsSync(nuxtBinPath)) {
    return false // already installed and ready
  }

  if (existsSync(nodeModulesPath) && !existsSync(nuxtBinPath)) {
    console.warn(`[dev-server] node_modules exists but nuxt binary is missing in ${worktreeDir}. Reinstalling...`)
  }

  const pm = detectPackageManager(worktreeDir)
  if (!pm) {
    console.warn(`[dev-server] No package manager detected in ${worktreeDir}`)
    return false
  }

  console.log(`[dev-server] Installing dependencies with ${pm.cmd} in ${worktreeDir}...`)
  try {
    const { stdout, stderr } = await execAsync(`${pm.cmd} ${pm.args.join(' ')}`, {
      cwd: worktreeDir,
      timeout: 180000,
      env: { ...process.env, CI: 'true' },
    })
    if (stderr) console.warn(`[dev-server] Install stderr: ${stderr.slice(0, 500)}`)
    console.log(`[dev-server] Dependencies installed in ${worktreeDir}`)

    // Verify the binary exists after install
    if (!existsSync(nuxtBinPath)) {
      console.warn(`[dev-server] Warning: nuxt binary still not found after install`)
    }

    return true
  } catch (err: any) {
    console.error(`[dev-server] Dependency installation failed: ${err.message}`)
    if (err.stderr) console.error(`[dev-server] Install error output: ${err.stderr.slice(0, 500)}`)
    return false
  }
}

async function waitForPort(port: number, proc: ReturnType<typeof spawn>, timeoutMs = 90000): Promise<boolean> {
  const start = Date.now()
  let lastStatus = ''
  let curlAvailable: boolean | null = null

  while (Date.now() - start < timeoutMs) {
    // Check if process died
    if (proc.killed || proc.exitCode !== null) {
      console.error(`[dev-server] Process died before port ${port} was ready (exitCode=${proc.exitCode})`)
      return false
    }

    try {
      let status = ''

      if (curlAvailable !== false) {
        try {
          const { stdout, stderr } = await execAsync(
            `curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`,
            { timeout: 3000 }
          )
          status = stdout.trim()
          curlAvailable = true
          if (stderr) console.warn(`[dev-server] curl stderr: ${stderr.slice(0, 200)}`)
        } catch (curlErr: any) {
          if (curlErr.message?.includes('command not found') || curlErr.code === 127) {
            curlAvailable = false
            console.warn(`[dev-server] curl not available, falling back to Node http`)
          }
        }
      }

      if (curlAvailable === false) {
        // Fallback: use Node's native http module
        status = await new Promise<string>((resolve) => {
          const http = require('http')
          const req = http.get(`http://localhost:${port}`, { timeout: 3000 }, (res: any) => {
            resolve(String(res.statusCode))
          })
          req.on('error', () => resolve(''))
          req.on('timeout', () => { req.destroy(); resolve('') })
        })
      }

      // ANY non-empty HTTP status code means the server is accepting connections
      if (status && status !== '000' && !isNaN(Number(status))) {
        console.log(`[dev-server] Port ${port} ready (HTTP ${status})`)
        return true
      }

      if (status !== lastStatus) {
        lastStatus = status
        console.log(`[dev-server] Port ${port} not ready yet (HTTP ${status || 'no-response'}), elapsed: ${Date.now() - start}ms`)
      }
    } catch (err: any) {
      console.warn(`[dev-server] Port check error: ${err.message}`)
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  console.error(`[dev-server] Port ${port} did not become ready within ${timeoutMs}ms`)
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

  // Install dependencies if missing (temporary — will be cleaned up on stop)
  const installedDeps = await installDependencies(worktreeDir)

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
    installedDeps,
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

  const ready = await waitForPort(port, proc, 90000)
  if (!ready) {
    try { proc.kill('SIGTERM') } catch {}
    activeDevServers.delete(worktreeDir)
    throw new Error(`Dev server failed to start on port ${port} within 90s`)
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

    // Remove temporary node_modules if we installed them this session
    if (info.installedDeps) {
      const nodeModulesPath = path.join(worktreeDir, 'node_modules')
      try {
        rmSync(nodeModulesPath, { recursive: true, force: true })
        console.log(`[dev-server] Cleaned up temporary node_modules in ${worktreeDir}`)
      } catch (err: any) {
        console.warn(`[dev-server] Failed to clean up node_modules: ${err.message}`)
      }
    }
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
