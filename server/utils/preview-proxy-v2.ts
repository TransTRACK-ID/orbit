import http from 'http'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { requireAuth } from './auth'
import { isPreviewStatic } from './preview-orchestrator'

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

  const task = instance.task as any
  const workspaceId = task?.project?.workspaceId
  if (!workspaceId) {
    throw createError({ statusCode: 404, statusMessage: 'Preview workspace not found' })
  }

  const member = await db.query.workspaceMembers.findFirst({
    where: (wm, { and, eq }) =>
      and(
        eq(wm.workspaceId, workspaceId),
        eq(wm.userId, user.id)
      ),
  })

  if (!member) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (instance.status !== 'running') {
    console.log(`[preview-proxy] Instance ${instanceId} status is ${instance.status}, not running`)
    throw createError({ statusCode: 503, statusMessage: 'Preview is not running' })
  }

  const port = instance.port
  if (!port) {
    throw createError({ statusCode: 503, statusMessage: 'Preview port not configured' })
  }

  console.log(`[preview-proxy] Proxying to instance ${instanceId} on port ${port}, path: ${event.node.req.url}`)

  return new Promise<void>((resolve, reject) => {
    const req = event.node.req
    const res = event.node.res

    const isStatic = isPreviewStatic(instanceId)
    console.log(`[preview-proxy] Instance ${instanceId} isStatic=${isStatic}`)
    
    let targetPath: string
    if (isStatic) {
      // For static server, strip the /api/preview/{id} prefix
      targetPath = req.url?.replace(`/api/preview/${instanceId}`, '') || '/'
    } else {
      // For SSR Nitro, pass the full path including the prefix
      // Nitro handles baseURL internally
      targetPath = req.url || '/'
    }
    console.log(`[preview-proxy] Target path: ${targetPath}`)

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
        console.log(`[preview-proxy] Proxy response status: ${proxyRes.statusCode}`)
        delete proxyRes.headers['x-frame-options']
        delete proxyRes.headers['X-Frame-Options']
        delete proxyRes.headers['content-security-policy']
        delete proxyRes.headers['Content-Security-Policy']

        // Rewrite Location header to preserve preview path
        // Always rewrite for both static and SSR — Nitro doesn't always prepend
        // baseURL to custom redirects (e.g., setHeader('location', '/'))
        const location = proxyRes.headers['location']
        if (location && typeof location === 'string') {
          if (location.startsWith('/') && !location.startsWith(`/api/preview/${instanceId}`)) {
            proxyRes.headers['location'] = `/api/preview/${instanceId}${location}`
            console.log(`[preview-proxy] Rewrote Location: ${location} → ${proxyRes.headers['location']}`)
          }
        }

        // Rewrite Set-Cookie paths to scope cookies to the preview app
        // Always rewrite for both static and SSR — apps may set cookies with Path=/
        // which would leak to the parent Orbit app on the same domain
        const setCookie = proxyRes.headers['set-cookie']
        if (setCookie) {
          proxyRes.headers['set-cookie'] = setCookie.map((cookie: string) => {
            return cookie.replace(/Path=([^;]+)/, (match, path) => {
              const trimmedPath = path.trim()
              if (trimmedPath.startsWith(`/api/preview/${instanceId}`)) {
                return match
              }
              if (trimmedPath === '/') {
                return `Path=/api/preview/${instanceId}/`
              }
              return `Path=/api/preview/${instanceId}${trimmedPath}`
            })
          })
        }

        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
        proxyRes.pipe(res)
        proxyRes.on('end', resolve)
        proxyRes.on('error', reject)
      }
    )

    proxyReq.on('error', (err) => {
      console.error(`[preview-proxy] Proxy error for instance ${instanceId} port ${port}: ${err.message}`)
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
