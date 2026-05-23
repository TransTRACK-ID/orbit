import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import path from 'path'
import type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types'

const execAsync = promisify(exec)

export const LaravelAdapter: PreviewAdapter = {
  name: 'laravel',

  async detect(worktreeDir: string): Promise<boolean> {
    const hasArtisan = existsSync(path.join(worktreeDir, 'artisan'))
    console.log(`[laravel-adapter] detect() checking ${worktreeDir}/artisan, exists=${hasArtisan}`)
    return hasArtisan
  },

  async build(config: PreviewConfig): Promise<BuildResult> {
    const { worktreeDir, envVars } = config

    const buildEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...envVars,
      NODE_ENV: 'production',
    }

    try {
      // Optimize Laravel for production
      await execAsync('php artisan optimize', {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 120000,
      })

      await execAsync('php artisan config:cache', {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 60000,
      })

      const publicDir = path.join(worktreeDir, 'public')
      if (existsSync(publicDir)) {
        return { success: true, outputDir: publicDir, isStatic: false }
      }

      return { success: false, outputDir: '', isStatic: false, error: 'public/ directory not found' }
    } catch (error: any) {
      return { success: false, outputDir: '', isStatic: false, error: error.message }
    }
  },

  async start(config: PreviewConfig, buildResult: BuildResult): Promise<ServerInfo> {
    const { port, worktreeDir } = config

    // Use Laravel's built-in serve command (production-like enough for preview)
    const proc = spawn('php', ['artisan', 'serve', `--port=${port}`, '--host=127.0.0.1'], {
      cwd: worktreeDir,
      env: {
        ...process.env,
        APP_URL: `http://127.0.0.1:${port}`,
      },
      stdio: 'pipe',
    })

    return {
      pid: proc.pid || 0,
      port,
      command: `php artisan serve --port=${port}`,
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
