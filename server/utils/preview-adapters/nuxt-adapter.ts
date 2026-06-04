import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync, readdirSync, writeFileSync, rmSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types'

const execAsync = promisify(exec)

export const NuxtAdapter: PreviewAdapter = {
  name: 'nuxt',

  async detect(worktreeDir: string): Promise<boolean> {
    const pkgPath = path.join(worktreeDir, 'package.json')
    console.log(`[nuxt-adapter] detect() checking ${pkgPath}, exists=${existsSync(pkgPath)}`)
    if (!existsSync(pkgPath)) {
      console.log(`[nuxt-adapter] package.json not found at ${pkgPath}`)
      return false
    }

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const hasNuxt = 'nuxt' in deps
      console.log(`[nuxt-adapter] package.json found, deps keys=${Object.keys(deps).slice(0, 10)}, hasNuxt=${hasNuxt}`)
      return hasNuxt
    } catch (err: any) {
      console.error(`[nuxt-adapter] Error parsing package.json: ${err.message}`)
      return false
    }
  },

  async build(config: PreviewConfig): Promise<BuildResult> {
    const { worktreeDir, port, envVars, baseUrl } = config

    const buildEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...envVars,
      NUXT_APP_BASE_URL: baseUrl,
      NUXT_PUBLIC_API_BASE_URL: baseUrl.replace(/\/$/, ''),
      API_BASE_URL: `http://127.0.0.1:${port}${baseUrl}`,
      NODE_ENV: 'production',
    }

    // Disable SSR for preview to prevent auth redirect loops
    // Local auth provider stores tokens client-side (localStorage), so SSR can't see them
    const nuxtConfigPath = path.join(worktreeDir, 'nuxt.config.ts')
    const nuxtConfigJsPath = path.join(worktreeDir, 'nuxt.config.js')
    const configPath = existsSync(nuxtConfigPath) ? nuxtConfigPath : existsSync(nuxtConfigJsPath) ? nuxtConfigJsPath : null
    
    if (configPath) {
      const originalConfig = await readFile(configPath, 'utf-8')
      let modifiedConfig = originalConfig
      
      // Force ssr: false for previews to prevent auth redirect loops
      if (/ssr\s*:/.test(originalConfig)) {
        // Replace existing ssr: ... with ssr: false
        modifiedConfig = originalConfig.replace(/ssr\s*:\s*[^,\n]+/, 'ssr: false')
        console.log(`[nuxt-adapter] Replaced existing ssr with ssr: false in ${configPath}`)
      } else {
        // Inject ssr: false if not present
        modifiedConfig = originalConfig.replace(
          /export\s+default\s+defineNuxtConfig\s*\(\s*\{/,
          'export default defineNuxtConfig({\n  ssr: false,'
        )
        console.log(`[nuxt-adapter] Injected ssr: false into ${configPath}`)
      }
      
      // Ensure app.baseURL is set so Vue Router respects the preview path
      // This prevents navigateTo('/') from redirecting to the domain root
      if (!/app\s*:\s*\{[^}]*baseURL/.test(modifiedConfig)) {
        if (/app\s*:\s*\{/.test(modifiedConfig)) {
          modifiedConfig = modifiedConfig.replace(
            /app\s*:\s*\{/,
            `app: {\n    baseURL: process.env.NUXT_APP_BASE_URL || '/',`
          )
          console.log(`[nuxt-adapter] Added baseURL to app config in ${configPath}`)
        } else if (/ssr\s*:\s*false/.test(modifiedConfig)) {
          // ssr was injected, add app after it
          modifiedConfig = modifiedConfig.replace(
            /(ssr\s*:\s*false,)/,
            '$1\n  app: { baseURL: process.env.NUXT_APP_BASE_URL || \'/\' },'
          )
          console.log(`[nuxt-adapter] Added app.baseURL after ssr in ${configPath}`)
        } else {
          modifiedConfig = modifiedConfig.replace(
            /export\s+default\s+defineNuxtConfig\s*\(\s*\{/,
            'export default defineNuxtConfig({\n  app: { baseURL: process.env.NUXT_APP_BASE_URL || \'/\' },'
          )
          console.log(`[nuxt-adapter] Injected app.baseURL into ${configPath}`)
        }
      }
      
      if (modifiedConfig !== originalConfig) {
        writeFileSync(configPath, modifiedConfig)
      }
    }

    // Check if nuxt binary exists
    const nuxtBinary = path.join(worktreeDir, 'node_modules', '.bin', 'nuxt')
    const hasNuxtBinary = existsSync(nuxtBinary)
    console.log(`[nuxt-adapter] Nuxt binary exists: ${hasNuxtBinary} at ${nuxtBinary}`)

    // Clear .nuxt cache to ensure clean build after config changes
    // Clear caches to ensure fresh build with our config modifications
    const nuxtCacheDir = path.join(worktreeDir, '.nuxt')
    if (existsSync(nuxtCacheDir)) {
      rmSync(nuxtCacheDir, { recursive: true, force: true })
      console.log(`[nuxt-adapter] Cleared .nuxt cache`)
    }
    const outputDir = path.join(worktreeDir, '.output')
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true })
      console.log(`[nuxt-adapter] Cleared .output directory for fresh build`)
    }

    const buildCommand = 'npx nuxt build'
    console.log(`[nuxt-adapter] Running build command: ${buildCommand}`)

    try {
      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 300000,
      })

      console.log(`[nuxt-adapter] Build stdout length: ${stdout.length}`)
      if (stderr) {
        console.warn('[nuxt-adapter] build stderr:', stderr)
      }

      // Check .output directory
      const outputDir = path.join(worktreeDir, '.output')
      console.log(`[nuxt-adapter] Checking .output directory: ${outputDir}, exists=${existsSync(outputDir)}`)
      
      if (existsSync(outputDir)) {
        const outputContents = readdirSync(outputDir)
        console.log(`[nuxt-adapter] .output contents: ${outputContents.join(', ')}`)
      }

      const serverOutput = path.join(worktreeDir, '.output', 'server')
      const nitroEntry = path.join(serverOutput, 'index.mjs')
      const staticOutput = path.join(worktreeDir, '.output', 'public')

      console.log(`[nuxt-adapter] serverOutput exists: ${existsSync(serverOutput)}`)
      console.log(`[nuxt-adapter] nitroEntry exists: ${existsSync(nitroEntry)}`)
      console.log(`[nuxt-adapter] staticOutput exists: ${existsSync(staticOutput)}`)

      // SSR build: server/index.mjs exists → use Nitro server
      if (existsSync(nitroEntry)) {
        console.log(`[nuxt-adapter] Detected SSR build (nitro server found)`)
        return { success: true, outputDir: serverOutput, isStatic: false }
      }

      // Static build: public/index.html exists → serve static files
      const indexHtml = path.join(staticOutput, 'index.html')
      if (existsSync(indexHtml)) {
        const publicContents = readdirSync(staticOutput)
        console.log(`[nuxt-adapter] Detected static build (index.html found)`)
        console.log(`[nuxt-adapter] Static output contents: ${publicContents.slice(0, 20).join(', ')}`)
        return { success: true, outputDir: staticOutput, isStatic: true }
      }

      // Fallback: just public dir exists but no index.html (incomplete build)
      if (existsSync(staticOutput)) {
        return { success: false, outputDir: staticOutput, isStatic: true, error: 'Build output has no index.html — app may need SSG/prerender configuration' }
      }

      return { success: false, outputDir: '', isStatic: true, error: 'Build completed but no output directory found' }
    } catch (error: any) {
      console.error(`[nuxt-adapter] Build error: ${error.message}`)
      console.error(`[nuxt-adapter] Build error stdout: ${error.stdout || 'none'}`)
      console.error(`[nuxt-adapter] Build error stderr: ${error.stderr || 'none'}`)
      return { success: false, outputDir: '', isStatic: true, error: error.message }
    }
  },

  async start(config: PreviewConfig, buildResult: BuildResult): Promise<ServerInfo> {
    const { port, worktreeDir } = config

    if (buildResult.isStatic) {
      return {
        pid: 0,
        port,
        command: 'static',
        isStaticServer: true,
      }
    }

    // For SSR, run Nitro server directly
    const nitroEntry = path.join(worktreeDir, '.output', 'server', 'index.mjs')
    if (!existsSync(nitroEntry)) {
      throw new Error(`Nitro server entry not found at ${nitroEntry}`)
    }

    const proc = spawn('node', [nitroEntry], {
      cwd: worktreeDir,
      env: {
        ...process.env,
        ...config.envVars,
        NITRO_PORT: String(port),
        PORT: String(port),
        NUXT_APP_BASE_URL: config.baseUrl,
        NUXT_PUBLIC_API_BASE_URL: config.baseUrl.replace(/\/$/, ''),
        NUXT_AUTH_SECRET: process.env.NUXT_AUTH_SECRET,
        NUXT_AUTH_ORIGIN: process.env.NUXT_AUTH_ORIGIN,
      },
      stdio: 'pipe',
    })

    // Log Nitro stdout/stderr for debugging
    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n')
      for (const line of lines) {
        if (line.trim()) console.log(`[nitro-server] ${line.trim()}`)
      }
    })
    proc.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n')
      for (const line of lines) {
        if (line.trim()) console.error(`[nitro-server] ${line.trim()}`)
      }
    })
    proc.on('error', (err) => {
      console.error(`[nitro-server] Process error: ${err.message}`)
    })
    proc.on('exit', (code) => {
      console.log(`[nitro-server] Process exited with code ${code}`)
    })

    // Wait a moment for the server to start
    await new Promise(resolve => setTimeout(resolve, 2000))

    return {
      pid: proc.pid || 0,
      port,
      command: `node ${nitroEntry}`,
      isStaticServer: false,
    }
  },

  async stop(serverInfo: ServerInfo): Promise<void> {
    if (serverInfo.pid > 0) {
      try {
        process.kill(serverInfo.pid, 'SIGTERM')
      } catch {
        // Process may already be dead
      }
    }
  }
}
