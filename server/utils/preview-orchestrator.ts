import http from 'http'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { existsSync, readdirSync } from 'fs'
import path from 'path'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { detectFramework } from './preview-adapters'
import { createStaticServer } from './preview-static-server'
import type { PreviewConfig } from './preview-adapters/types'
import { appendPreviewLog } from './preview-logger'

const execAsync = promisify(exec)

const activeServers = new Map<string, { server: http.Server | null; isStatic: boolean; childPid: number | null }>()

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
    return { cmd: 'npm', args: ['install'] }
  }
  return null
}

async function installDependencies(worktreeDir: string, instanceId: string): Promise<boolean> {
  const pm = detectPackageManager(worktreeDir)
  if (!pm) {
    await appendPreviewLog(instanceId, 'No package manager detected')
    return false
  }

  await appendPreviewLog(instanceId, `Installing dependencies with ${pm.cmd}...`)
  try {
    const { stdout, stderr } = await execAsync(`${pm.cmd} ${pm.args.join(' ')}`, {
      cwd: worktreeDir,
      env: { ...process.env, CI: 'true' },
      timeout: 180000,
    })
    if (stderr) {
      await appendPreviewLog(instanceId, `Install stderr: ${stderr.slice(0, 500)}`)
    }
    await appendPreviewLog(instanceId, 'Dependencies installed successfully')
    return true
  } catch (error: any) {
    await appendPreviewLog(instanceId, `Install failed: ${error.message}`)
    return false
  }
}

function getAvailablePort(): number {
  const used = Array.from(activeServers.values())
    .map(s => {
      if (!s.server) return null
      const addr = s.server.address()
      return addr && typeof addr === 'object' ? addr.port : null
    })
    .filter((p): p is number => p !== null)

  let port: number
  do {
    port = 9000 + Math.floor(Math.random() * 1000)
  } while (used.includes(port))
  return port
}

export async function startPreview(
  taskId: string,
  repositoryId: string | undefined,
  worktreeDir: string,
  repositoryEnvVars: Record<string, string> = {}
): Promise<{ instanceId: string; url: string }> {
  const db = getDb()

  console.log(`[preview-orchestrator] Starting preview for task ${taskId}`)
  console.log(`[preview-orchestrator] Worktree directory: ${worktreeDir}`)
  console.log(`[preview-orchestrator] Worktree exists: ${existsSync(worktreeDir)}`)
  
  // List files in worktree for debugging
  try {
    const files = readdirSync(worktreeDir)
    console.log(`[preview-orchestrator] Worktree files: ${files.slice(0, 20).join(', ')}`)
  } catch (err: any) {
    console.error(`[preview-orchestrator] Cannot read worktree: ${err.message}`)
  }

  const adapter = await detectFramework(worktreeDir)
  if (!adapter) {
    console.error(`[preview-orchestrator] No framework adapter matched for ${worktreeDir}`)
    throw new Error('No framework detected. Cannot build preview.')
  }

  const [instance] = await db.insert(schema.previewInstances)
    .values({
      taskId,
      framework: adapter.name,
      status: 'building',
      worktreeDir,
    })
    .returning()

  if (!instance) {
    throw new Error('Failed to create preview instance in database')
  }

  const instanceId = instance.id
  const port = getAvailablePort()
  const baseUrl = `/api/preview/${instanceId}/`

  await appendPreviewLog(instanceId, `Detected framework: ${adapter.name}`)

  // Install dependencies first
  const depsInstalled = await installDependencies(worktreeDir, instanceId)
  if (!depsInstalled) {
    await db.update(schema.previewInstances)
      .set({ status: 'failed', failReason: 'Dependency installation failed' })
      .where(eq(schema.previewInstances.id, instanceId))
    throw new Error('Failed to install dependencies')
  }

  await appendPreviewLog(instanceId, `Starting build on port ${port}...`)

  const config: PreviewConfig = {
    taskId,
    instanceId,
    port,
    baseUrl,
    worktreeDir,
    envVars: {
      ORBIT_PREVIEW: 'true',
      NUXT_IS_PREVIEW: 'true',
      ...repositoryEnvVars,
    },
  }

  try {
    const buildResult = await adapter.build(config)

    if (!buildResult.success) {
      const error = buildResult.error || 'Build failed'
      await db.update(schema.previewInstances)
        .set({ status: 'failed', failReason: error })
        .where(eq(schema.previewInstances.id, instanceId))
      await appendPreviewLog(instanceId, `Build failed: ${error}`)
      throw new Error(`Build failed: ${error}`)
    }

    await db.update(schema.previewInstances)
      .set({ outputDir: buildResult.outputDir, status: 'running', port })
      .where(eq(schema.previewInstances.id, instanceId))

    await appendPreviewLog(instanceId, `Build complete. Output: ${buildResult.outputDir}`)

    let server: http.Server | null = null
    let childPid: number | null = null

    if (buildResult.isStatic) {
      console.log(`[preview-orchestrator] Creating static server for ${buildResult.outputDir}`)
      
      // Verify build output exists
      if (!existsSync(buildResult.outputDir)) {
        throw new Error(`Build output directory does not exist: ${buildResult.outputDir}`)
      }
      
      const outputFiles = readdirSync(buildResult.outputDir)
      console.log(`[preview-orchestrator] Output directory contents: ${outputFiles.slice(0, 20).join(', ')}`)
      
      server = createStaticServer(buildResult.outputDir, port)
      
      // Wait a moment for server to start listening
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await appendPreviewLog(instanceId, `Static server listening on port ${port}`)
    } else {
      const serverInfo = await adapter.start(config, buildResult)
      childPid = serverInfo.pid
      await db.update(schema.previewInstances)
        .set({ pid: serverInfo.pid })
        .where(eq(schema.previewInstances.id, instanceId))
      await appendPreviewLog(instanceId, `Production server started (pid: ${serverInfo.pid})`)

      // For SSR, the Nitro server listens directly on the port — no proxy needed
      // The preview proxy will connect directly to localhost:port
    }

    activeServers.set(instanceId, { server, isStatic: buildResult.isStatic, childPid })

    return {
      instanceId,
      url: `/api/preview/${instanceId}`,
    }
  } catch (error: any) {
    await db.update(schema.previewInstances)
      .set({ status: 'failed', failReason: error.message })
      .where(eq(schema.previewInstances.id, instanceId))
    await appendPreviewLog(instanceId, `Preview failed: ${error.message}`)
    throw error
  }
}

export async function stopPreview(instanceId: string): Promise<void> {
  const db = getDb()
  const active = activeServers.get(instanceId)

  if (active) {
    if (active.server) {
      active.server.close()
    }
    if (active.childPid) {
      try {
        process.kill(active.childPid, 'SIGTERM')
      } catch {
        // Process may already be dead
      }
    }
    activeServers.delete(instanceId)
  }

  await db.update(schema.previewInstances)
    .set({ status: 'stopped' })
    .where(eq(schema.previewInstances.id, instanceId))
}

export async function getPreviewStatus(taskId: string) {
  const db = getDb()
  return db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.taskId, taskId),
    orderBy: (instances, { desc }) => [desc(instances.createdAt)],
  })
}

export async function getPreviewLogs(instanceId: string): Promise<string[]> {
  const db = getDb()
  const instance = await db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.id, instanceId),
  })
  return instance?.logs || []
}
