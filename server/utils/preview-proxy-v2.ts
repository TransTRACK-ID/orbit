import http from 'http'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { requireAuth } from './auth'

export async function proxyPreviewRequest(event: any, instanceId: string): Promise<void> {
  const user = await requireAuth(event)

  const db = getDb()
  const instance = await db.query.previewInstances.findFirst({
    where: eq(schema.previewInstances.id, instanceId),
    with: {
      task: {
        with: {
          project: {
            with: {
              workspace: true,
            },
          },
        },
      },
    },
  })

  if (!instance) {
    throw createError({ statusCode: 404, statusMessage: 'Preview not found' })
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(
        eq(wm.workspaceId, instance.task.project.workspaceId),
        eq(wm.userId, user.id)
      ),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (instance.status !== 'running') {
    throw createError({ statusCode: 503, statusMessage: 'Preview is not running' })
  }

  const port = instance.port
  if (!port) {
    throw createError({ statusCode: 503, statusMessage: 'Preview port not configured' })
  }

  return new Promise<void>((resolve, reject) => {
    const req = event.node.req
    const res = event.node.res

    const targetPath = req.url?.replace(`/api/preview/${instanceId}`, '') || '/'

    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: targetPath,
        method: req.method,
        headers: {
          ...req.headers,
          host: `localhost:${port}`,
        },
        timeout: 30000,
      },
      (proxyRes) => {
        delete proxyRes.headers['x-frame-options']
        delete proxyRes.headers['X-Frame-Options']
        delete proxyRes.headers['content-security-policy']
        delete proxyRes.headers['Content-Security-Policy']

        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
        proxyRes.pipe(res)
        proxyRes.on('end', resolve)
        proxyRes.on('error', reject)
      }
    )

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        res.statusCode = 502
        res.end(`Preview proxy error: ${err.message}`)
      }
      reject(err)
    })

    proxyReq.on('timeout', () => {
      proxyReq.destroy()
      if (!res.headersSent) {
        res.statusCode = 504
        res.end('Preview proxy timeout')
      }
      reject(new Error('Timeout'))
    })

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq)
    } else {
      proxyReq.end()
    }
  })
}
