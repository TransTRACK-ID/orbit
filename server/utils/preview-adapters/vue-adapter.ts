import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types'

const execAsync = promisify(exec)

export const VueAdapter: PreviewAdapter = {
  name: 'vue',

  async detect(worktreeDir: string): Promise<boolean> {
    const pkgPath = path.join(worktreeDir, 'package.json')
    console.log(`[vue-adapter] detect() checking ${pkgPath}, exists=${existsSync(pkgPath)}`)
    if (!existsSync(pkgPath)) {
      console.log(`[vue-adapter] package.json not found at ${pkgPath}`)
      return false
    }

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const hasVue = 'vue' in deps
      const hasNuxt = 'nuxt' in deps
      console.log(`[vue-adapter] package.json found, hasVue=${hasVue}, hasNuxt=${hasNuxt}`)
      return hasVue && !hasNuxt
    } catch (err: any) {
      console.error(`[vue-adapter] Error parsing package.json: ${err.message}`)
      return false
    }
  },

  async build(config: PreviewConfig): Promise<BuildResult> {
    const { worktreeDir, envVars, baseUrl } = config

    const buildEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...envVars,
      NODE_ENV: 'production',
    }

    const buildCommand = `npx vite build --base ${baseUrl}`
    console.log(`[vue-adapter] Running build command: ${buildCommand}`)

    try {
      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 300000,
      })

      if (stderr) {
        console.warn('[vue-adapter] build stderr:', stderr)
      }

      const staticOutput = path.join(worktreeDir, 'dist')
      console.log(`[vue-adapter] Checking output directory: ${staticOutput}, exists=${existsSync(staticOutput)}`)

      if (existsSync(staticOutput)) {
        const indexHtml = path.join(staticOutput, 'index.html')
        if (existsSync(indexHtml)) {
          console.log(`[vue-adapter] Detected static build (index.html found)`)
          return { success: true, outputDir: staticOutput, isStatic: true }
        }
      }

      return { success: false, outputDir: '', isStatic: true, error: 'Build completed but no output directory found' }
    } catch (error: any) {
      console.error(`[vue-adapter] Build error: ${error.message}`)
      return { success: false, outputDir: '', isStatic: true, error: error.message }
    }
  },

  async start(config: PreviewConfig, buildResult: BuildResult): Promise<ServerInfo> {
    const { port } = config

    return {
      pid: 0,
      port,
      command: 'static',
      isStaticServer: true,
    }
  },

  async stop(serverInfo: ServerInfo): Promise<void> {
    if (serverInfo.pid > 0) {
      try {
        process.kill(serverInfo.pid, 'SIGTERM')
      } catch {}
    }
  }
}
