import http from 'http'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { detectFramework } from './preview-adapters'
import { createStaticServer } from './preview-static-server'
import type { PreviewConfig } from './preview-adapters/types'
import { appendPreviewLog } from './preview-logger'

const activeServers = new Map<string, { server: http.Server; isStatic: boolean }>()

function getAvailablePort(): number {
  const used = Array.from(activeServers.values())
    .map(s => {
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
  worktreeDir: string
): Promise<{ instanceId: string; url: string }> {
  const db = getDb()

  const adapter = await detectFramework(worktreeDir)
  if (!adapter) {
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

  const instanceId = instance.id
  const port = getAvailablePort()
  const baseUrl = `/api/preview/${instanceId}/`

  await appendPreviewLog(instanceId, `Detected framework: ${adapter.name}`)
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

    let server: http.Server

    if (buildResult.isStatic) {
      server = createStaticServer(buildResult.outputDir, port)
      await appendPreviewLog(instanceId, `Static server listening on port ${port}`)
    } else {
      const serverInfo = await adapter.start(config, buildResult)
      await db.update(schema.previewInstances)
        .set({ pid: serverInfo.pid })
        .where(eq(schema.previewInstances.id, instanceId))
      await appendPreviewLog(instanceId, `Production server started (pid: ${serverInfo.pid})`)

      server = http.createServer((req, res) => {
        const proxyReq = http.request({
          hostname: '127.0.0.1',
          port: serverInfo.port,
          path: req.url,
          method: req.method,
          headers: req.headers,
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
          proxyRes.pipe(res)
        })

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.statusCode = 502
            res.end(`Proxy error: ${err.message}`)
          }
        })

        req.pipe(proxyReq)
      })

      server.listen(port, '127.0.0.1')
    }

    activeServers.set(instanceId, { server, isStatic: buildResult.isStatic })

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
    active.server.close()
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
