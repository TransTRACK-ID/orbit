import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync, rmSync, copyFileSync } from 'fs'
import path from 'path'
import http from 'http'
import { resolveCloneDir, resolveWorktreeDir } from './worktree-resolver'

const execAsync = promisify(exec)

// Version marker — MUST see this in logs or server is still running old code
const CODE_VERSION = 'v3-USE-NPM-20250514'

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

export function getDevServerByTask(task: { id: string; repository?: { url: string; name?: string | null } | null }): DevServerInfo | undefined {
  if (!task.repository?.url) return undefined
  const cloneDir = resolveCloneDir(task.repository.url, task.repository.name)
  const worktreeDir = resolveWorktreeDir(cloneDir, task.id)
  const info = activeDevServers.get(worktreeDir)
  if (info && info.ready) return info

  // Fallback: scan activeDevServers for any worktree matching this task ID
  // This covers edge cases where the worktree has a random suffix or the
  // path was computed with a different projectsDir.
  for (const [dir, serverInfo] of activeDevServers) {
    if (dir.includes(`.task-${task.id}`) && serverInfo.ready) {
      return serverInfo
    }
  }

  return undefined
}

export async function getBrowserQueueStatus(): Promise<{ isRunning: boolean; queued: number; nextJob: string | null }> {
  // Re-exported from browser-queue for health endpoint usage
  // We import lazily to avoid circular deps
  const { getQueueStatus } = await import('./browser-queue')
  return getQueueStatus()
}

function getAvailablePort(): number {
  // Use a random port in the 9000-9999 range
  return 9000 + Math.floor(Math.random() * 1000)
}

function copyEnvToWorktree(worktreeDir: string): void {
  // Try to find .env in the git repo root (parent of the worktree or sibling)
  const possibleEnvPaths = [
    path.join(worktreeDir, '.env'), // already there?
    path.join(path.dirname(worktreeDir), '.env'), // sibling
    path.join(path.dirname(path.dirname(worktreeDir)), '.env'), // grandparent (repo root)
    path.join(process.cwd(), '.env'), // server cwd
  ]

  const worktreeEnv = path.join(worktreeDir, '.env')
  if (existsSync(worktreeEnv)) return // already exists

  for (const envPath of possibleEnvPaths) {
    if (existsSync(envPath) && envPath !== worktreeEnv) {
      try {
        copyFileSync(envPath, worktreeEnv)
        console.log(`[dev-server] Copied .env from ${envPath} to worktree`)
        return
      } catch (err: any) {
        console.warn(`[dev-server] Failed to copy .env: ${err.message}`)
      }
    }
  }
}

function detectPackageManager(worktreeDir: string): { cmd: string; args: string[] } | null {
  if (existsSync(path.join(worktreeDir, 'bun.lockb'))) {
    return { cmd: 'bun', args: ['install'] }
  }
  if (existsSync(path.join(worktreeDir, 'pnpm-lock.yaml'))) {
    return { cmd: 'pnpm', args: ['install'] }
  }
  if (existsSync(path.join(worktreeDir, 'yarn.lock'))) {
    return { cmd: 'yarn', args: ['install'] }
  }
  if (existsSync(path.join(worktreeDir, 'package-lock.json'))) {
    return { cmd: 'npm', args: ['install'] }
  }
  if (existsSync(path.join(worktreeDir, 'package.json'))) {
    // Default to npm as the safest universal fallback in containerized environments
    return { cmd: 'npm', args: ['install'] }
  }
  return null
}

function verifyCriticalModules(worktreeDir: string): boolean {
  const criticalPaths = [
    path.join(worktreeDir, 'node_modules', '@nuxt', 'kit'),
    path.join(worktreeDir, 'node_modules', '@nuxt', 'cli'),
    path.join(worktreeDir, 'node_modules', 'nuxt', 'package.json'),
  ]
  const missing = criticalPaths.filter(p => !existsSync(p))
  if (missing.length > 0) {
    console.warn(`[dev-server] Missing critical modules: ${missing.map(p => path.basename(p)).join(', ')}`)
    return false
  }
  return true
}

async function installDependencies(worktreeDir: string): Promise<boolean> {
  const nodeModulesPath = path.join(worktreeDir, 'node_modules')

  // Always do a clean install for QA worktrees.
  if (existsSync(nodeModulesPath)) {
    console.log(`[dev-server] Removing existing node_modules in ${worktreeDir} for clean install...`)
    try {
      rmSync(nodeModulesPath, { recursive: true, force: true })
      console.log(`[dev-server] Removed stale node_modules`)
    } catch (err: any) {
      console.warn(`[dev-server] Failed to remove node_modules: ${err.message}`)
    }
  }

  const pm = detectPackageManager(worktreeDir)
  if (!pm) {
    console.warn(`[dev-server] No package manager detected in ${worktreeDir}`)
    return false
  }

  // Primary install attempt
  console.log(`[dev-server] Installing dependencies with ${pm.cmd} in ${worktreeDir}...`)
  try {
    const installCmd = pm.cmd === 'npm'
      ? `${pm.cmd} ${pm.args.join(' ')}`
      : `${pm.cmd} ${pm.args.join(' ')}`

    const { stdout, stderr } = await execAsync(installCmd, {
      cwd: worktreeDir,
      timeout: 180000,
      env: { ...process.env, CI: 'true' },
    })
    if (stderr) console.warn(`[dev-server] Install stderr: ${stderr.slice(0, 500)}`)
    console.log(`[dev-server] ${pm.cmd} install completed`)
  } catch (err: any) {
    console.error(`[dev-server] ${pm.cmd} install failed: ${err.message}`)
    if (err.stderr) console.error(`[dev-server] Install error: ${err.stderr.slice(0, 500)}`)
    // Continue to verify — partial install might still work
  }

  // Verify critical Nuxt modules are present
  if (verifyCriticalModules(worktreeDir)) {
    console.log(`[dev-server] All critical modules verified`)
    return true
  }

  // Fallback: try npm install (most reliable)
  if (pm.cmd !== 'npm') {
    console.log(`[dev-server] Falling back to npm install...`)
    try {
      const { stdout, stderr } = await execAsync('npm install', {
        cwd: worktreeDir,
        timeout: 180000,
        env: { ...process.env, CI: 'true' },
      })
      if (stderr) console.warn(`[dev-server] npm stderr: ${stderr.slice(0, 500)}`)
      console.log(`[dev-server] npm install completed`)
    } catch (err: any) {
      console.error(`[dev-server] npm fallback failed: ${err.message}`)
    }

    if (verifyCriticalModules(worktreeDir)) {
      console.log(`[dev-server] Critical modules verified after npm fallback`)
      return true
    }
  }

  console.error(`[dev-server] CRITICAL: Nuxt modules still missing after install. Dev server will fail.`)
  return false
}

async function waitForPort(port: number, proc: ReturnType<typeof spawn>, timeoutMs = 120000): Promise<boolean> {
  const start = Date.now()
  let lastStatus = ''

  while (Date.now() - start < timeoutMs) {
    // Check if process died
    if (proc.killed || proc.exitCode !== null) {
      console.error(`[dev-server] Process died before port ${port} was ready (exitCode=${proc.exitCode})`)
      return false
    }

    try {
      let status = ''

      // Primary: use Node's native http module (works everywhere, no curl dependency)
      status = await new Promise<string>((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}`, { timeout: 3000 }, (res: any) => {
          resolve(String(res.statusCode))
          // consume response to free the socket
          res.resume()
        })
        req.on('error', (err: any) => {
          // Expected before server is ready: ECONNREFUSED, ECONNRESET
          resolve('')
        })
        req.on('timeout', () => {
          req.destroy()
          resolve('')
        })
        req.setTimeout(3000, () => {
          req.destroy()
          resolve('')
        })
      })

      // Wait for the server to be truly ready — accept 2xx-4xx (server is responsive)
      // Reject 5xx errors (server broken or still initializing)
      const statusNum = Number(status)
      if (status && status !== '000' && !isNaN(statusNum) && statusNum >= 200 && statusNum < 500) {
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
    await new Promise(r => setTimeout(r, 1500))
  }
  console.error(`[dev-server] Port ${port} did not become ready within ${timeoutMs}ms`)
  return false
}

function detectDevCommand(worktreeDir: string, port: number): { command: string; args: string[]; env: Record<string, string> } | null {
  // Use the same package manager for running as for installing
  const pm = detectPackageManager(worktreeDir)
  const runCmd = pm?.cmd || 'npm'

  const packageJsonPath = path.join(worktreeDir, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      const scripts = pkg.scripts || {}
      if (scripts.dev) {
        // Pass port via -- --port for frameworks that support it (Vite, Nuxt, Next)
        return { command: runCmd, args: ['run', 'dev', '--', '--port', String(port)], env: {} }
      }
      if (scripts.start) {
        return { command: runCmd, args: ['run', 'start', '--', '--port', String(port)], env: {} }
      }
      if (scripts.serve) {
        return { command: runCmd, args: ['run', 'serve', '--', '--port', String(port)], env: {} }
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

export async function startDevServer(worktreeDir: string, repositoryId?: string, taskId?: string): Promise<DevServerInfo> {
  const existing = activeDevServers.get(worktreeDir)
  if (existing && existing.ready) {
    return existing
  }

  // Kill any previous dev server for this worktree to prevent
  // concurrent access to node_modules during reinstall
  if (existing) {
    console.log(`[dev-server] Killing previous dev server for ${worktreeDir} before restart`)
    try {
      existing.proc.kill('SIGTERM')
      // Poll until process actually exits (up to 5s)
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500))
        if (existing.proc.killed || existing.proc.exitCode !== null) break
      }
      if (!existing.proc.killed && existing.proc.exitCode === null) {
        try { existing.proc.kill('SIGKILL') } catch {}
        await new Promise(r => setTimeout(r, 1000))
      }
    } catch {}
    activeDevServers.delete(worktreeDir)
  }

  const port = getAvailablePort()
  const baseUrl = `http://localhost:${port}`

  console.log(`[dev-server] ${CODE_VERSION} Starting dev server for ${worktreeDir} on port ${port}`)

  // Copy .env from repo root to worktree if missing
  copyEnvToWorktree(worktreeDir)

  // Install dependencies (always clean install for QA worktrees)
  const installedDeps = await installDependencies(worktreeDir)

  // Clean .nuxt cache to avoid stale builds in reused worktrees
  const nuxtCachePath = path.join(worktreeDir, '.nuxt')
  if (existsSync(nuxtCachePath)) {
    try {
      rmSync(nuxtCachePath, { recursive: true, force: true })
      console.log(`[dev-server] Cleaned .nuxt cache in ${worktreeDir}`)
    } catch (err: any) {
      console.warn(`[dev-server] Failed to clean .nuxt cache: ${err.message}`)
    }
  }

  // Fetch repository environment variables if repositoryId is provided
  let repositoryEnv: Record<string, string> = {}
  if (repositoryId) {
    try {
      const { getDb, schema } = await import('~/server/database')
      const { eq } = await import('drizzle-orm')
      const db = getDb()
      const envVars = await db.query.repositoryEnvVars.findMany({
        where: eq(schema.repositoryEnvVars.repositoryId, repositoryId),
      })
      for (const ev of envVars) {
        repositoryEnv[ev.key] = ev.value
      }
      console.log(`[dev-server] Loaded ${envVars.length} repository env vars for repository ${repositoryId}`)
    } catch (err: any) {
      console.warn(`[dev-server] Failed to load repository env vars: ${err.message}`)
    }
  }

  const devCmd = detectDevCommand(worktreeDir, port)
  if (!devCmd) {
    throw new Error(`No dev command detected in ${worktreeDir}. Ensure package.json with a "dev" script exists.`)
  }

  // Run nuxt prepare to generate .nuxt/ files before starting dev server
  const nuxtBin = path.join(worktreeDir, 'node_modules', '.bin', 'nuxt')
  if (existsSync(nuxtBin)) {
    console.log(`[dev-server] Running nuxt prepare...`)
    try {
      await execAsync(`${nuxtBin} prepare`, {
        cwd: worktreeDir,
        timeout: 60000,
        env: { ...process.env, CI: 'true' },
      })
      console.log(`[dev-server] nuxt prepare completed`)
    } catch (err: any) {
      console.warn(`[dev-server] nuxt prepare failed: ${err.message}`)
    }
  }

  const env = {
    ...process.env,
    PORT: String(port),
    NUXT_PORT: String(port),
    VITE_PORT: String(port),
    NEXT_PORT: String(port),
    NUXT_TELEMETRY_DISABLED: '1',
    // Override AUTH_ORIGIN so the dev server uses its own port for auth
    // instead of inheriting the production container's value.
    AUTH_ORIGIN: `http://localhost:${port}`,
    // Tell Nuxt/Vue Router its base URL so it mounts correctly under the proxy path
    ...(taskId ? { NUXT_APP_BASE_URL: `/api/preview/${taskId}/` } : {}),
    // Repository env vars take highest precedence (after devCmd.env)
    ...repositoryEnv,
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

  proc.on('exit', (code, signal) => {
    console.log(`[dev-server] ${worktreeDir} exited with code=${code} signal=${signal} (${CODE_VERSION})`)
    activeDevServers.delete(worktreeDir)
    // Note: node_modules cleanup is done in stopDevServer() after QA completes,
    // NOT here, to prevent race conditions with concurrent server restarts
  })

  proc.on('error', (err) => {
    console.error(`[dev-server] ${worktreeDir} error: ${err.message} (${CODE_VERSION})`)
    activeDevServers.delete(worktreeDir)
  })

  const ready = await waitForPort(port, proc, 120000)
  if (!ready) {
    try { proc.kill('SIGTERM') } catch {}
    activeDevServers.delete(worktreeDir)
    throw new Error(`Dev server failed to start on port ${port} within 120s (${CODE_VERSION})`)
  }

  info.ready = true
  console.log(`[dev-server] Ready at ${baseUrl} for ${worktreeDir}`)
  return info
}

export async function stopDevServer(worktreeDir: string): Promise<void> {
  const info = activeDevServers.get(worktreeDir)
  if (!info) return

  // Kill the process
  try {
    info.proc.kill('SIGTERM')
  } catch {}

  // Wait for process to actually exit (up to 8s)
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 500))
    if (info.proc.killed || info.proc.exitCode !== null) break
  }

  // Force kill if still running
  if (!info.proc.killed && info.proc.exitCode === null) {
    try { info.proc.kill('SIGKILL') } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }

  activeDevServers.delete(worktreeDir)
}

export function stopAllDevServers(): void {
  // Fire-and-forget async cleanup (process exit handlers can't be async)
  for (const [worktreeDir] of activeDevServers) {
    stopDevServer(worktreeDir).catch(() => {})
  }
}

// Cleanup on process exit
process.on('exit', stopAllDevServers)
process.on('SIGINT', stopAllDevServers)
process.on('SIGTERM', stopAllDevServers)
