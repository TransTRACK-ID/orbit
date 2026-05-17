import { defineEventHandler, getRouterParams } from 'h3'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import http from 'http'
import { getDevServerByTask } from '~/server/utils/dev-server-orchestrator'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { taskId } = getRouterParams(event)

  // 1. Auth & task lookup
  const db = getDb()
  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
    with: {
      repository: true,
      project: { with: { workspace: true } },
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  // Verify workspace membership
  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(eq(wm.workspaceId, task.project.workspaceId), eq(wm.userId, user.id)),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // 2. Find active dev server
  const devServer = getDevServerByTask(task)
  if (!devServer) {
    throw createError({ statusCode: 503, statusMessage: 'Preview server is not running' })
  }

  // 3. Proxy the request
  const targetPath = event.path.replace(`/api/preview/${taskId}`, '') || '/'

  // Extract query string from the original request
  const originalUrl = event.node.req.url || ''
  const queryIndex = originalUrl.indexOf('?')
  const queryString = queryIndex !== -1 ? originalUrl.slice(queryIndex) : ''
  const fullTargetPath = targetPath + queryString

  return new Promise<void>((resolve, reject) => {
    const req = event.node.req
    const res = event.node.res

    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port: devServer.port,
        path: fullTargetPath,
        method: req.method,
        headers: {
          ...req.headers,
          host: `localhost:${devServer.port}`,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
        proxyRes.pipe(res)
        proxyRes.on('end', resolve)
        proxyRes.on('error', (err) => {
          console.error(`[preview-proxy] Response error for ${taskId}:`, err.message)
          reject(err)
        })
      }
    )

    proxyReq.on('error', (err) => {
      console.error(`[preview-proxy] Request error for ${taskId}:`, err.message)
      if (!res.headersSent) {
        res.statusCode = 502
        res.end(`Preview proxy error: ${err.message}`)
      }
      reject(err)
    })

    // Forward body for POST/PUT/PATCH
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq)
    } else {
      proxyReq.end()
    }
  })
})
