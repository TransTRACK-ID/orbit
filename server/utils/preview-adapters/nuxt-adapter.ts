import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
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

    // Check if nuxt binary exists
    const nuxtBinary = path.join(worktreeDir, 'node_modules', '.bin', 'nuxt')
    const hasNuxtBinary = existsSync(nuxtBinary)
    console.log(`[nuxt-adapter] Nuxt binary exists: ${hasNuxtBinary} at ${nuxtBinary}`)

    const buildCommand = hasNuxtBinary ? 'npx nuxt build' : 'npx nuxt build'
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
        const { readdirSync } = require('fs')
        const outputContents = readdirSync(outputDir)
        console.log(`[nuxt-adapter] .output contents: ${outputContents.join(', ')}`)
      }

      const staticOutput = path.join(worktreeDir, '.output', 'public')
      const serverOutput = path.join(worktreeDir, '.output')

      console.log(`[nuxt-adapter] staticOutput exists: ${existsSync(staticOutput)}`)
      console.log(`[nuxt-adapter] serverOutput exists: ${existsSync(serverOutput)}`)

      if (existsSync(staticOutput)) {
        const publicContents = require('fs').readdirSync(staticOutput)
        console.log(`[nuxt-adapter] Static output contents: ${publicContents.slice(0, 20).join(', ')}`)
        return { success: true, outputDir: staticOutput, isStatic: true }
      }

      if (existsSync(serverOutput)) {
        return { success: true, outputDir: serverOutput, isStatic: false }
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

    const proc = spawn('npx', ['nuxt', 'preview', '--port', String(port)], {
      cwd: worktreeDir,
      env: {
        ...process.env,
        PORT: String(port),
        NUXT_PORT: String(port),
      },
      stdio: 'pipe',
    })

    return {
      pid: proc.pid || 0,
      port,
      command: `npx nuxt preview --port ${port}`,
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
