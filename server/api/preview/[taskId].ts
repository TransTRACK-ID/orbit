import { defineEventHandler, getRouterParams } from 'h3'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import http from 'http'
import { getDevServerByTask } from '~/server/utils/dev-server-orchestrator'

function isTextResponse(headers: http.IncomingHttpHeaders): boolean {
  const ct = headers['content-type'] || ''
  return typeof ct === 'string' && (
    ct.includes('text/html') ||
    ct.includes('application/javascript') ||
    ct.includes('text/javascript') ||
    ct.includes('text/css') ||
    ct.includes('application/json')
  )
}

function rewriteAssetUrls(body: string, proxyPrefix: string): string {
  // Nuxt & Vite dev server asset prefixes that need to go through the proxy.
  // When the iframe loads HTML from the main origin, absolute paths like /_nuxt/...
  // resolve against the parent origin and bypass the proxy. We rewrite them so
  // every asset request routes back through /api/preview/{taskId}/.
  const prefixes = [
    '/_nuxt/',
    '/@vite/',
    '/@fs/',
    '/@id/',
    '/__vite_ping',
    '/__nuxt/',
    '/__nuxt_error__',
  ]

  for (const prefix of prefixes) {
    // Double-quote wrapped
    body = body.replace(
      new RegExp(`"${prefix.replace(/\//g, '\\/')}`, 'g'),
      `"${proxyPrefix}${prefix}`
    )
    // Single-quote wrapped
    body = body.replace(
      new RegExp(`'${prefix.replace(/\//g, '\\/')}`, 'g'),
      `'${proxyPrefix}${prefix}`
    )
    // CSS url() — matches url(/_nuxt/...) or url("/_nuxt/...)
    body = body.replace(
      new RegExp(`url\\(\\s*["']?${prefix.replace(/\//g, '\\/')}`, 'g'),
      `url(${proxyPrefix}${prefix}`
    )
  }

  return body
}

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

  const proxyPrefix = `/api/preview/${taskId}`

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
        // For text responses (HTML, JS, CSS, JSON), buffer and rewrite asset URLs
        // so the browser routes them back through this proxy instead of
        // resolving them against the parent origin.
        if (isTextResponse(proxyRes.headers)) {
          const chunks: Buffer[] = []

          proxyRes.on('data', (chunk: Buffer) => {
            chunks.push(chunk)
          })

          proxyRes.on('end', () => {
            let body = Buffer.concat(chunks).toString('utf-8')
            body = rewriteAssetUrls(body, proxyPrefix)

            const modifiedBody = Buffer.from(body, 'utf-8')

            // Update content-length to match modified body
            const headers = { ...proxyRes.headers }
            headers['content-length'] = modifiedBody.length
            // Prevent downstream caching of rewritten responses
            headers['cache-control'] = 'no-store'

            res.writeHead(proxyRes.statusCode || 200, headers)
            res.end(modifiedBody)
            resolve()
          })

          proxyRes.on('error', (err) => {
            console.error(`[preview-proxy] Response error for ${taskId}:`, err.message)
            reject(err)
          })
        } else {
          // Binary responses — stream through unchanged
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
          proxyRes.pipe(res)
          proxyRes.on('end', resolve)
          proxyRes.on('error', (err) => {
            console.error(`[preview-proxy] Response error for ${taskId}:`, err.message)
            reject(err)
          })
        }
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
