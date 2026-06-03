import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types'

const execAsync = promisify(exec)

export const ReactAdapter: PreviewAdapter = {
  name: 'react',

  async detect(worktreeDir: string): Promise<boolean> {
    const pkgPath = path.join(worktreeDir, 'package.json')
    console.log(`[react-adapter] detect() checking ${pkgPath}, exists=${existsSync(pkgPath)}`)
    if (!existsSync(pkgPath)) {
      console.log(`[react-adapter] package.json not found at ${pkgPath}`)
      return false
    }

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const hasReact = 'react-dom' in deps
      console.log(`[react-adapter] package.json found, hasReact=${hasReact}`)
      return hasReact
    } catch (err: any) {
      console.error(`[react-adapter] Error parsing package.json: ${err.message}`)
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

    try {
      const pkgPath = path.join(worktreeDir, 'package.json')
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const hasVite = 'vite' in deps

      let buildCommand: string
      let staticOutput: string

      if (hasVite) {
        buildCommand = `npx vite build --base ${baseUrl}`
        staticOutput = path.join(worktreeDir, 'dist')
        console.log(`[react-adapter] Detected Vite-based React project`)
      } else {
        buildCommand = 'npx react-scripts build'
        buildEnv.PUBLIC_URL = baseUrl
        staticOutput = path.join(worktreeDir, 'build')
        console.log(`[react-adapter] Detected Create React App project`)
      }

      console.log(`[react-adapter] Running build command: ${buildCommand}`)

      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 300000,
      })

      if (stderr) {
        console.warn('[react-adapter] build stderr:', stderr)
      }

      console.log(`[react-adapter] Checking output directory: ${staticOutput}, exists=${existsSync(staticOutput)}`)

      if (existsSync(staticOutput)) {
        const indexHtml = path.join(staticOutput, 'index.html')
        if (existsSync(indexHtml)) {
          console.log(`[react-adapter] Detected static build (index.html found)`)
          return { success: true, outputDir: staticOutput, isStatic: true }
        }
      }

      return { success: false, outputDir: '', isStatic: true, error: 'Build completed but no output directory found' }
    } catch (error: any) {
      console.error(`[react-adapter] Build error: ${error.message}`)
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
