import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, readFileSync, rmSync, copyFileSync, writeFileSync } from 'fs'
import path from 'path'
import http from 'http'
import { resolveCloneDir, resolveWorktreeDir } from './worktree-resolver'

const execAsync = promisify(exec)

// Version marker — MUST see this in logs or server is still running old code
const CODE_VERSION = 'v3-USE-NPM-20250514'

export type PreviewMode = 'dev' | 'build'

export type DevServerInfo = {
  worktreeDir: string
  proc: ReturnType<typeof spawn>
  port: number
  baseUrl: string
  ready: boolean
  installedDeps: boolean
  logs: string[]
  failed: boolean
  failReason?: string
  mode: PreviewMode
}

const activeDevServers = new Map<string, DevServerInfo>()

function getOrCreateDevServerInfo(worktreeDir: string): DevServerInfo {
  let info = activeDevServers.get(worktreeDir)
  if (!info) {
    info = {
      worktreeDir,
      proc: null as any,
      port: 0,
      baseUrl: '',
      ready: false,
      installedDeps: false,
      logs: [],
      failed: false,
      mode: 'dev',
    }
    activeDevServers.set(worktreeDir, info)
  }
  return info
}

function appendLog(worktreeDir: string, line: string) {
  const info = getOrCreateDevServerInfo(worktreeDir)
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
  info.logs.push(`[${timestamp}] ${line}`)
  // Keep only last 500 lines to prevent unbounded memory growth
  if (info.logs.length > 500) {
    info.logs = info.logs.slice(-500)
  }
}

export function getDevServerLogs(worktreeDir: string): string[] {
  return activeDevServers.get(worktreeDir)?.logs || []
}

export function getDevServerStatus(worktreeDir: string): DevServerInfo | undefined {
  return activeDevServers.get(worktreeDir)
}

export function getDevServerByTask(
  task: { id: string; repository?: { url: string; name?: string | null } | null },
  opts: { includeNotReady?: boolean } = {}
): DevServerInfo | undefined {
  if (!task.repository?.url) return undefined
  const cloneDir = resolveCloneDir(task.repository.url, task.repository.name)
  const worktreeDir = resolveWorktreeDir(cloneDir, task.id)
  const info = activeDevServers.get(worktreeDir)
  if (info && (info.ready || opts.includeNotReady)) return info

  // Fallback: scan activeDevServers for any worktree matching this task ID
  for (const [dir, serverInfo] of activeDevServers) {
    if (dir.includes(`.task-${task.id}`) && (serverInfo.ready || opts.includeNotReady)) {
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
        appendLog(worktreeDir, `Copied .env from ${envPath} to worktree`)
        return
      } catch (err: any) {
        appendLog(worktreeDir, `Failed to copy .env: ${err.message}`)
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
    appendLog(worktreeDir, `Missing critical modules: ${missing.map(p => path.basename(p)).join(', ')}`)
    return false
  }
  return true
}

async function runInstall(worktreeDir: string, cmd: string, args: string[], env: Record<string, string> = {}): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const fullCmd = `${cmd} ${args.join(' ')}`
    appendLog(worktreeDir, `$ ${fullCmd}`)
    const child = spawn(cmd, args, {
      cwd: worktreeDir,
      env: { ...process.env, ...env },
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text
      text.split('\n').filter(Boolean).forEach((line) => appendLog(worktreeDir, line))
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text
      text.split('\n').filter(Boolean).forEach((line) => appendLog(worktreeDir, `ERR: ${line}`))
    })

    child.on('exit', (code) => {
      appendLog(worktreeDir, `Exit code: ${code}`)
      resolve({ ok: code === 0, stdout, stderr })
    })

    child.on('error', (err) => {
      appendLog(worktreeDir, `Spawn error: ${err.message}`)
      resolve({ ok: false, stdout, stderr })
    })

    // Hard timeout
    setTimeout(() => {
      try { child.kill('SIGTERM') } catch {}
      appendLog(worktreeDir, 'Install timed out after 180s')
      resolve({ ok: false, stdout, stderr })
    }, 180000)
  })
}

async function runBuild(worktreeDir: string, cmd: string, args: string[], env: Record<string, string> = {}): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const fullCmd = `${cmd} ${args.join(' ')}`
    appendLog(worktreeDir, `$ ${fullCmd}`)
    const child = spawn(cmd, args, {
      cwd: worktreeDir,
      env: { ...process.env, ...env },
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text
      text.split('\n').filter(Boolean).forEach((line) => appendLog(worktreeDir, line))
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text
      text.split('\n').filter(Boolean).forEach((line) => appendLog(worktreeDir, `ERR: ${line}`))
    })

    child.on('exit', (code) => {
      appendLog(worktreeDir, `Build exit code: ${code}`)
      resolve({ ok: code === 0, stdout, stderr })
    })

    child.on('error', (err) => {
      appendLog(worktreeDir, `Build spawn error: ${err.message}`)
      resolve({ ok: false, stdout, stderr })
    })

    // Hard timeout for build (5 minutes)
    setTimeout(() => {
      try { child.kill('SIGTERM') } catch {}
      appendLog(worktreeDir, 'Build timed out after 300s')
      resolve({ ok: false, stdout, stderr })
    }, 300000)
  })
}

async function installDependencies(worktreeDir: string): Promise<boolean> {
  const nodeModulesPath = path.join(worktreeDir, 'node_modules')

  appendLog(worktreeDir, '=== Starting dependency installation ===')

  // Always do a clean install for QA worktrees.
  if (existsSync(nodeModulesPath)) {
    appendLog(worktreeDir, 'Removing existing node_modules for clean install...')
    try {
      rmSync(nodeModulesPath, { recursive: true, force: true })
      appendLog(worktreeDir, 'Removed stale node_modules')
    } catch (err: any) {
      appendLog(worktreeDir, `Failed to remove node_modules: ${err.message}`)
    }
  }

  const pm = detectPackageManager(worktreeDir)
  if (!pm) {
    appendLog(worktreeDir, 'No package manager detected')
    return false
  }

  // Primary install attempt
  appendLog(worktreeDir, `Installing dependencies with ${pm.cmd}...`)
  const primary = await runInstall(worktreeDir, pm.cmd, pm.args, { CI: 'true' })
  if (primary.ok) {
    appendLog(worktreeDir, `${pm.cmd} install completed`)
  } else {
    appendLog(worktreeDir, `${pm.cmd} install failed`)
  }

  // Verify critical Nuxt modules are present
  if (verifyCriticalModules(worktreeDir)) {
    appendLog(worktreeDir, 'All critical modules verified')
    return true
  }

  // Fallback 1: npm with --legacy-peer-deps (fixes common peer dep conflicts in Nuxt 4 migrations)
  const hasPeerConflict = primary.stderr.includes('ERESOLVE') || primary.stderr.includes('peer dependency')
  if (pm.cmd === 'npm' && hasPeerConflict) {
    appendLog(worktreeDir, 'Detected peer dependency conflict, retrying with --legacy-peer-deps...')
    const legacy = await runInstall(worktreeDir, 'npm', ['install', '--legacy-peer-deps'], { CI: 'true' })
    if (legacy.ok) {
      appendLog(worktreeDir, 'npm install --legacy-peer-deps completed')
    } else {
      appendLog(worktreeDir, 'npm install --legacy-peer-deps failed')
    }

    if (verifyCriticalModules(worktreeDir)) {
      appendLog(worktreeDir, 'Critical modules verified after --legacy-peer-deps')
      return true
    }
  }

  // Fallback 2: try npm install (most reliable universal fallback)
  if (pm.cmd !== 'npm') {
    appendLog(worktreeDir, 'Falling back to npm install...')
    const fallback = await runInstall(worktreeDir, 'npm', ['install'], { CI: 'true' })
    if (fallback.ok) {
      appendLog(worktreeDir, 'npm install completed')
    } else {
      appendLog(worktreeDir, 'npm fallback failed')
    }

    if (verifyCriticalModules(worktreeDir)) {
      appendLog(worktreeDir, 'Critical modules verified after npm fallback')
      return true
    }
  }

  // Fallback 3: npm with --legacy-peer-deps (universal last resort for non-npm PMs)
  if (pm.cmd !== 'npm') {
    appendLog(worktreeDir, 'Last resort: npm install --legacy-peer-deps...')
    const lastResort = await runInstall(worktreeDir, 'npm', ['install', '--legacy-peer-deps'], { CI: 'true' })
    if (lastResort.ok) {
      appendLog(worktreeDir, 'npm install --legacy-peer-deps completed')
    } else {
      appendLog(worktreeDir, 'npm install --legacy-peer-deps failed')
    }

    if (verifyCriticalModules(worktreeDir)) {
      appendLog(worktreeDir, 'Critical modules verified after last resort')
      return true
    }
  }

  // Fallback 4: npm with --force (nuclear option for stubborn peer deps)
  appendLog(worktreeDir, 'Nuclear option: npm install --force...')
  const nuclear = await runInstall(worktreeDir, 'npm', ['install', '--force'], { CI: 'true' })
  if (nuclear.ok) {
    appendLog(worktreeDir, 'npm install --force completed')
  } else {
    appendLog(worktreeDir, 'npm install --force failed')
  }

  if (verifyCriticalModules(worktreeDir)) {
    appendLog(worktreeDir, 'Critical modules verified after --force')
    return true
  }

  appendLog(worktreeDir, 'CRITICAL: Nuxt modules still missing after all install attempts. Dev server will fail.')
  return false
}

async function waitForPort(port: number, proc: ReturnType<typeof spawn>, worktreeDir: string, timeoutMs = 120000): Promise<boolean> {
  const start = Date.now()
  let lastStatus = ''

  while (Date.now() - start < timeoutMs) {
    // Check if process died
    if (proc.killed || proc.exitCode !== null) {
      appendLog(worktreeDir, `Process died before port ${port} was ready (exitCode=${proc.exitCode})`)
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
        appendLog(worktreeDir, `Port ${port} responsive (HTTP ${status}), waiting 3s for full Nuxt/Vite initialization...`)
        // Give Nuxt extra time to finish setting up the Vite Node IPC socket.
        // Without this delay, the first proxied request arrives before NUXT_VITE_NODE_OPTIONS
        // is configured, causing "Vite Node IPC socket path not configured" errors.
        await new Promise(r => setTimeout(r, 3000))
        appendLog(worktreeDir, `Port ${port} ready`)
        return true
      }

      if (status !== lastStatus) {
        lastStatus = status
        appendLog(worktreeDir, `Port ${port} not ready yet (HTTP ${status || 'no-response'}), elapsed: ${Date.now() - start}ms`)
      }
    } catch (err: any) {
      appendLog(worktreeDir, `Port check error: ${err.message}`)
    }
    await new Promise(r => setTimeout(r, 1500))
  }
  appendLog(worktreeDir, `Port ${port} did not become ready within ${timeoutMs}ms`)
  return false
}

function isNuxtProject(worktreeDir: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(path.join(worktreeDir, 'package.json'), 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    return 'nuxt' in deps
  } catch {
    return false
  }
}

/**
 * For Nuxt projects in the live preview environment, disable SSR to avoid the
 * "Vite Node IPC socket path not configured" crash.
 *
 * Root cause: @nuxt/vite-builder/dist/vite-node.mjs reads NUXT_VITE_NODE_OPTIONS
 * at module-scope (cached once at import time). But the env var is only set later
 * when ViteNodePlugin.configureServer fires. The first page request triggers the
 * Nitro SSR renderer which tries to talk to vite-node via IPC → crash.
 *
 * Fix: inject `ssr: false` via a Nuxt config override file. With SSR off, Nitro
 * serves a client-only SPA shell and never calls the vite-node IPC path for page
 * rendering. For live preview (visual change inspection), SPA mode is adequate.
 */
function patchNuxtForPreview(worktreeDir: string): void {
  if (!isNuxtProject(worktreeDir)) return

  // Write a Nuxt config override that disables SSR and configures the dev server
  // for container access. This is loaded by Nuxt's layer/extends system.
  const overridePath = path.join(worktreeDir, 'nuxt.config.preview-override.ts')
  const overrideContent = `// Auto-generated by Orbit live preview — disables SSR to avoid Vite Node IPC issues
export default defineNuxtConfig({
  ssr: false,
  devServer: {
    host: '0.0.0.0',
  },
  vite: {
    server: {
      allowedHosts: 'all',
    },
  },
})
`
  try {
    writeFileSync(overridePath, overrideContent)
    appendLog(worktreeDir, 'Wrote nuxt.config.preview-override.ts (SSR disabled for live preview)')
  } catch (err: any) {
    appendLog(worktreeDir, `Failed to write preview override: ${err.message}`)
  }

  // Patch the project's nuxt.config to extend from the override.
  // We do this by reading the existing config and prepending an extends clause.
  const configPaths = [
    path.join(worktreeDir, 'nuxt.config.ts'),
    path.join(worktreeDir, 'nuxt.config.js'),
  ]
  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue
    try {
      const content = readFileSync(configPath, 'utf-8')
      // Skip if already patched
      if (content.includes('preview-override')) break

      // Inject `extends: ['./nuxt.config.preview-override']` into defineNuxtConfig
      const patched = content.replace(
        /defineNuxtConfig\(\s*\{/,
        `defineNuxtConfig({\n  extends: ['./nuxt.config.preview-override'],`
      )
      if (patched !== content) {
        writeFileSync(configPath, patched)
        appendLog(worktreeDir, `Patched ${path.basename(configPath)} to extend preview-override`)
      }
    } catch (err: any) {
      appendLog(worktreeDir, `Failed to patch nuxt config: ${err.message}`)
    }
    break
  }
}

function unpatchNuxtForPreview(worktreeDir: string): void {
  if (!isNuxtProject(worktreeDir)) return

  // Remove the preview-override extends from nuxt.config so build mode
  // runs with the project's original SSR configuration.
  const configPaths = [
    path.join(worktreeDir, 'nuxt.config.ts'),
    path.join(worktreeDir, 'nuxt.config.js'),
  ]
  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue
    try {
      const content = readFileSync(configPath, 'utf-8')
      // Skip if not patched
      if (!content.includes('preview-override')) break

      // Remove the extends line that references preview-override
      const patched = content.replace(
        /\n\s*extends:\s*\['\.\/nuxt\.config\.preview-override'\],?/,
        ''
      )
      if (patched !== content) {
        writeFileSync(configPath, patched)
        appendLog(worktreeDir, `Removed preview-override from ${path.basename(configPath)} (build mode)`)
      }
    } catch (err: any) {
      appendLog(worktreeDir, `Failed to unpatch nuxt config: ${err.message}`)
    }
    break
  }
}

function detectDevCommand(worktreeDir: string, port: number, mode: PreviewMode = 'dev'): { command: string; args: string[]; env: Record<string, string> } | null {
  // Use the same package manager for running as for installing
  const pm = detectPackageManager(worktreeDir)
  const runCmd = pm?.cmd || 'npm'

  const packageJsonPath = path.join(worktreeDir, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      const scripts = pkg.scripts || {}

      if (mode === 'build') {
        // For build mode, use preview command if available, otherwise nuxt preview
        if (scripts.preview) {
          return { command: runCmd, args: ['run', 'preview', '--', '--port', String(port)], env: {} }
        }
        // Fall back to npx nuxt preview for Nuxt projects
        if (isNuxtProject(worktreeDir)) {
          return { command: 'npx', args: ['nuxt', 'preview', '--port', String(port)], env: {} }
        }
        // Generic preview fallback
        return { command: runCmd, args: ['run', 'start', '--', '--port', String(port)], env: {} }
      }

      // Dev mode (original logic)
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

export async function startDevServer(
  worktreeDir: string,
  repositoryId?: string,
  taskId?: string,
  mode: PreviewMode = 'dev'
): Promise<DevServerInfo> {
  const existing = activeDevServers.get(worktreeDir)
  if (existing && existing.ready && existing.mode === mode) {
    return existing
  }

  // Kill any previous dev server for this worktree to prevent
  // concurrent access to node_modules during reinstall
  if (existing) {
    appendLog(worktreeDir, 'Killing previous dev server before restart')
    try {
      existing.proc.kill('SIGTERM')
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500))
        if (existing.proc.killed || existing.proc.exitCode !== null) break
      }
      if (!existing.proc.killed && existing.proc.exitCode === null) {
        try { existing.proc.kill('SIGKILL') } catch {}
        await new Promise(r => setTimeout(r, 1000))
      }
    } catch {}
    // Mark as not ready so we start fresh, but PRESERVE logs for diagnostics
    existing.ready = false
    existing.failed = false
    existing.failReason = undefined
  }

  const port = getAvailablePort()
  const baseUrl = `http://localhost:${port}`

  appendLog(worktreeDir, `${CODE_VERSION} Starting ${mode} preview server for ${worktreeDir} on port ${port}`)

  // Copy .env from repo root to worktree if missing
  copyEnvToWorktree(worktreeDir)

  // Install dependencies (always clean install for QA worktrees)
  const installedDeps = await installDependencies(worktreeDir)

  // Clean .nuxt cache to avoid stale builds in reused worktrees
  const nuxtCachePath = path.join(worktreeDir, '.nuxt')
  if (existsSync(nuxtCachePath)) {
    try {
      rmSync(nuxtCachePath, { recursive: true, force: true })
      appendLog(worktreeDir, 'Cleaned .nuxt cache')
    } catch (err: any) {
      appendLog(worktreeDir, `Failed to clean .nuxt cache: ${err.message}`)
    }
  }

  // Also clean .output for build mode to ensure fresh build
  const outputPath = path.join(worktreeDir, '.output')
  if (mode === 'build' && existsSync(outputPath)) {
    try {
      rmSync(outputPath, { recursive: true, force: true })
      appendLog(worktreeDir, 'Cleaned .output directory for fresh build')
    } catch (err: any) {
      appendLog(worktreeDir, `Failed to clean .output: ${err.message}`)
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
      appendLog(worktreeDir, `Loaded ${envVars.length} repository env vars`)
    } catch (err: any) {
      appendLog(worktreeDir, `Failed to load repository env vars: ${err.message}`)
    }
  }

  const devCmd = detectDevCommand(worktreeDir, port, mode)
  if (!devCmd) {
    const reason = `No ${mode} command detected in ${worktreeDir}. Ensure package.json with a "${mode === 'build' ? 'preview' : 'dev'}" script exists.`
    const info = getOrCreateDevServerInfo(worktreeDir)
    info.failed = true
    info.failReason = reason
    appendLog(worktreeDir, reason)
    throw new Error(reason)
  }

  // For Nuxt projects in DEV mode only: patch config to disable SSR for live preview to avoid
  // the Vite Node IPC socket race condition. Must run BEFORE nuxt prepare.
  // For BUILD mode, we keep SSR enabled for true production-like preview.
  if (mode === 'dev') {
    patchNuxtForPreview(worktreeDir)
  } else {
    appendLog(worktreeDir, 'Build mode: SSR enabled (removing preview override)')
    unpatchNuxtForPreview(worktreeDir)
  }

  const isNuxt = isNuxtProject(worktreeDir)

  // Run nuxt prepare to generate .nuxt/ files before starting dev server
  const nuxtBin = path.join(worktreeDir, 'node_modules', '.bin', 'nuxt')
  if (existsSync(nuxtBin)) {
    appendLog(worktreeDir, 'Running nuxt prepare...')
    try {
      const prepareResult = await runInstall(worktreeDir, nuxtBin, ['prepare'], { CI: 'true' })
      if (prepareResult.ok) {
        appendLog(worktreeDir, 'nuxt prepare completed')
      } else {
        appendLog(worktreeDir, `nuxt prepare failed: ${prepareResult.stderr.slice(0, 500)}`)
      }
    } catch (err: any) {
      appendLog(worktreeDir, `nuxt prepare failed: ${err.message}`)
    }
  }

  // For BUILD mode on Nuxt projects: run nuxt build first
  if (mode === 'build' && isNuxt) {
    appendLog(worktreeDir, '=== Running Nuxt build for preview (this may take 30-60s) ===')
    const buildResult = await runBuild(worktreeDir, 'npx', ['nuxt', 'build'], {
      CI: 'true',
      NUXT_TELEMETRY_DISABLED: '1',
      ...(taskId ? {
        NUXT_APP_BASE_URL: `/api/preview/${taskId}/`,
        // Server-side base URL must be ABSOLUTE so Nitro's $fetch can resolve it.
        // Client-side uses NUXT_PUBLIC_API_BASE_URL (relative, through proxy).
        API_BASE_URL: `http://127.0.0.1:${port}/api/preview/${taskId}`,
        NUXT_PUBLIC_API_BASE_URL: `/api/preview/${taskId}`,
        NUXT_API_BASE_URL: `/api/preview/${taskId}`,
      } : {}),
      ...repositoryEnv,
    })

    if (!buildResult.ok) {
      const reason = `Nuxt build failed. Check logs above for errors.`
      const info = getOrCreateDevServerInfo(worktreeDir)
      info.failed = true
      info.failReason = reason
      appendLog(worktreeDir, reason)
      throw new Error(reason)
    }

    appendLog(worktreeDir, '=== Nuxt build completed successfully ===')
  }

  const env = {
    ...process.env,
    NODE_ENV: mode === 'build' ? 'production' : 'development',
    PORT: String(port),
    NUXT_PORT: String(port),
    VITE_PORT: String(port),
    NEXT_PORT: String(port),
    NUXT_TELEMETRY_DISABLED: '1',
    AUTH_ORIGIN: `http://localhost:${port}`,
    ...(taskId ? {
      NUXT_APP_BASE_URL: `/api/preview/${taskId}/`,
      // Server-side base URL must be ABSOLUTE so Nitro's $fetch can resolve it.
      // Client-side uses NUXT_PUBLIC_API_BASE_URL (relative, through proxy).
      API_BASE_URL: `http://127.0.0.1:${port}/api/preview/${taskId}`,
      // Nuxt runtime config mappings
      NUXT_PUBLIC_API_BASE_URL: `/api/preview/${taskId}`,
      NUXT_API_BASE_URL: `/api/preview/${taskId}`,
    } : {}),
    ...repositoryEnv,
    ...devCmd.env,
  }

  const proc = spawn(devCmd.command, devCmd.args, {
    cwd: worktreeDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env,
  })

  const info = getOrCreateDevServerInfo(worktreeDir)
  info.proc = proc
  info.port = port
  info.baseUrl = baseUrl
  info.ready = false
  info.installedDeps = installedDeps
  info.failed = false
  info.failReason = undefined
  info.mode = mode

  // Capture dev server output into logs
  proc.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    text.split('\n').filter(Boolean).forEach((line) => {
      appendLog(worktreeDir, line)
      // Also echo to server console for debugging
      console.log(`[dev-server ${worktreeDir}] ${line.slice(0, 200)}`)
    })
  })

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString()
    text.split('\n').filter(Boolean).forEach((line) => {
      appendLog(worktreeDir, `ERR: ${line}`)
      console.error(`[dev-server ${worktreeDir}] ${line.slice(0, 200)}`)
    })
  })

  proc.on('exit', (code, signal) => {
    appendLog(worktreeDir, `${mode} server exited with code=${code} signal=${signal}`)
    info.ready = false
    if (code !== 0 && code !== null) {
      info.failed = true
      info.failReason = `${mode} server crashed with exit code ${code}`
    }
    // Do NOT delete from activeDevServers so logs remain accessible
  })

  proc.on('error', (err) => {
    appendLog(worktreeDir, `${mode} server spawn error: ${err.message}`)
    info.failed = true
    info.failReason = `Failed to start ${mode} server: ${err.message}`
  })

  const ready = await waitForPort(port, proc, worktreeDir, mode === 'build' ? 60000 : 120000)
  if (!ready) {
    try { proc.kill('SIGTERM') } catch {}
    info.ready = false
    info.failed = true
    info.failReason = `${mode} server failed to start on port ${port} within ${mode === 'build' ? '60' : '120'}s. Check logs for details.`
    appendLog(worktreeDir, info.failReason)
    throw new Error(info.failReason)
  }

  info.ready = true
  appendLog(worktreeDir, `Ready at ${baseUrl} (${mode} mode)`)
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

  // Mark as stopped but keep logs for diagnostics
  info.ready = false
  info.failed = false
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
