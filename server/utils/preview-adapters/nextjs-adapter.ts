import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types'

const execAsync = promisify(exec)

export const NextJsAdapter: PreviewAdapter = {
  name: 'nextjs',

  async detect(worktreeDir: string): Promise<boolean> {
    const pkgPath = path.join(worktreeDir, 'package.json')
    console.log(`[nextjs-adapter] detect() checking ${pkgPath}, exists=${existsSync(pkgPath)}`)
    if (!existsSync(pkgPath)) return false

    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const hasNext = 'next' in deps
      console.log(`[nextjs-adapter] package.json found, hasNext=${hasNext}`)
      return hasNext
    } catch (err: any) {
      console.error(`[nextjs-adapter] Error parsing package.json: ${err.message}`)
      return false
    }
  },

  async build(config: PreviewConfig): Promise<BuildResult> {
    const { worktreeDir, envVars, baseUrl } = config

    const buildEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...envVars,
      NEXT_PUBLIC_BASE_PATH: baseUrl.replace(/\/$/, ''),
      NODE_ENV: 'production',
    }

    try {
      const { stdout, stderr } = await execAsync('npx next build', {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 300000,
      })

      const staticOutput = path.join(worktreeDir, 'out')
      const serverOutput = path.join(worktreeDir, '.next')

      if (existsSync(staticOutput)) {
        return { success: true, outputDir: staticOutput, isStatic: true }
      }

      if (existsSync(serverOutput)) {
        return { success: true, outputDir: serverOutput, isStatic: false }
      }

      return { success: false, outputDir: '', isStatic: true, error: 'No output directory found' }
    } catch (error: any) {
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

    const proc = spawn('npx', ['next', 'start', '--port', String(port)], {
      cwd: worktreeDir,
      env: {
        ...process.env,
        PORT: String(port),
      },
      stdio: 'pipe',
    })

    return {
      pid: proc.pid || 0,
      port,
      command: `npx next start --port ${port}`,
      isStaticServer: false,
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
