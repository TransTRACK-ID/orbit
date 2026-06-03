import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import path from 'path'
import type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types'

const execAsync = promisify(exec)

export const FlutterAdapter: PreviewAdapter = {
  name: 'flutter',

  async detect(worktreeDir: string): Promise<boolean> {
    const pubspecPath = path.join(worktreeDir, 'pubspec.yaml')
    console.log(`[flutter-adapter] detect() checking ${pubspecPath}, exists=${existsSync(pubspecPath)}`)
    if (!existsSync(pubspecPath)) {
      console.log(`[flutter-adapter] pubspec.yaml not found at ${pubspecPath}`)
      return false
    }

    try {
      const pubspec = await readFile(pubspecPath, 'utf-8')
      const hasFlutter = pubspec.includes('flutter:')
      console.log(`[flutter-adapter] pubspec.yaml found, hasFlutter=${hasFlutter}`)
      return hasFlutter
    } catch (err: any) {
      console.error(`[flutter-adapter] Error reading pubspec.yaml: ${err.message}`)
      return false
    }
  },

  async build(config: PreviewConfig): Promise<BuildResult> {
    const { worktreeDir, envVars, baseUrl } = config

    const buildEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...envVars,
    }

    const buildCommand = `flutter build web --base-href ${baseUrl}`
    console.log(`[flutter-adapter] Running build command: ${buildCommand}`)

    try {
      const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: worktreeDir,
        env: buildEnv,
        timeout: 300000,
      })

      if (stderr) {
        console.warn('[flutter-adapter] build stderr:', stderr)
      }

      const staticOutput = path.join(worktreeDir, 'build', 'web')
      console.log(`[flutter-adapter] Checking output directory: ${staticOutput}, exists=${existsSync(staticOutput)}`)

      if (existsSync(staticOutput)) {
        const indexHtml = path.join(staticOutput, 'index.html')
        if (existsSync(indexHtml)) {
          console.log(`[flutter-adapter] Detected static build (index.html found)`)
          return { success: true, outputDir: staticOutput, isStatic: true }
        }
      }

      return { success: false, outputDir: '', isStatic: true, error: 'Build completed but no output directory found' }
    } catch (error: any) {
      console.error(`[flutter-adapter] Build error: ${error.message}`)
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
