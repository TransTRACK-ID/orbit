import { defineEventHandler, getRouterParams } from 'h3'
import { requireAuth } from '~/server/utils/auth'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import http from 'http'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
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
    body = body.replace(
      new RegExp(`"${prefix.replace(/\//g, '\\/')}`, 'g'),
      `"${proxyPrefix}${prefix}`
    )
    body = body.replace(
      new RegExp(`'${prefix.replace(/\//g, '\\/')}`, 'g'),
      `'${proxyPrefix}${prefix}`
    )
    body = body.replace(
      new RegExp(`url\\(\\s*["']?${prefix.replace(/\//g, '\\/')}`, 'g'),
      `url(${proxyPrefix}${prefix}`
    )
  }

  return body
}

function normalizeDevServerPath(urlPath: string): string {
  return urlPath
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.js':
    case '.mjs':
    case '.cjs': return 'application/javascript'
    case '.ts': return 'application/typescript'
    case '.css': return 'text/css'
    case '.html': return 'text/html'
    case '.json': return 'application/json'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.svg': return 'image/svg+xml'
    case '.ico': return 'image/x-icon'
    case '.woff2': return 'font/woff2'
    case '.woff': return 'font/woff'
    case '.ttf': return 'font/ttf'
    case '.eot': return 'application/vnd.ms-fontobject'
    case '.map': return 'application/json'
    default: return 'application/octet-stream'
  }
}

function looksLikeAsset(urlPath: string): boolean {
  const clean = urlPath.split('?')[0].split('#')[0]
  return /\.(js|mjs|cjs|ts|css|json|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)$/i.test(clean)
}

function tryServeFilesystemFallback(
  urlPath: string,
  worktreeDir: string,
  res: any
): boolean {
  if (!looksLikeAsset(urlPath)) return false

  let fsPath: string | null = null

  if (urlPath.startsWith('/_nuxt/')) {
    const candidate = urlPath.replace('/_nuxt/', '/')
    if (candidate.startsWith('/') && existsSync(candidate)) {
      fsPath = candidate
    }
  }

  if (!fsPath && urlPath.startsWith('/@fs/')) {
    const candidate = urlPath.replace('/@fs/', '/')
    if (candidate.startsWith('/') && existsSync(candidate)) {
      fsPath = candidate
    }
  }

  if (!fsPath) {
    const worktreeName = path.basename(worktreeDir)
    const idx = urlPath.indexOf('/' + worktreeName + '/')
    if (idx !== -1) {
      const afterWorktree = urlPath.slice(idx + worktreeName.length + 2)
      const candidate = path.join(worktreeDir, afterWorktree)
      if (existsSync(candidate)) {
        fsPath = candidate
      }
    }
  }

  if (!fsPath && urlPath.includes('node_modules/')) {
    const relativePart = urlPath.slice(urlPath.indexOf('node_modules/'))
    const candidate = path.join(worktreeDir, relativePart)
    if (existsSync(candidate)) {
      fsPath = candidate
    }
  }

  if (fsPath) {
    try {
      const data = readFileSync(fsPath)
      res.writeHead(200, {
        'content-type': guessContentType(fsPath),
        'content-length': String(data.length),
        'cache-control': 'no-store',
      })
      res.end(data)
      console.log(`[preview-proxy] filesystem fallback served ${urlPath} from ${fsPath}`)
      return true
    } catch (err: any) {
      console.error(`[preview-proxy] filesystem fallback failed for ${urlPath}:`, err.message)
    }
  }

  return false
}

export async function proxyPreviewRequest(event: any, taskId: string): Promise<void> {
  console.log(`[preview-proxy] HANDLER INVOKED: ${event.method} ${event.path}`)

  const user = await requireAuth(event)

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
  const devServer = getDevServerByTask({
    id: task.id,
    repository: task.repository,
  })
  if (!devServer) {
    throw createError({ statusCode: 503, statusMessage: 'Preview server is not running' })
  }

  // 3. Proxy the request
  const rawTargetPath = event.path.replace(`/api/preview/${taskId}`, '') || '/'
  const targetPath = normalizeDevServerPath(rawTargetPath)

  const originalUrl = event.node.req.url || ''
  const queryIndex = originalUrl.indexOf('?')
  const queryString = queryIndex !== -1 ? originalUrl.slice(queryIndex) : ''
  const fullTargetPath = targetPath + queryString

  const proxyPrefix = `/api/preview/${taskId}`

  console.log(`[preview-proxy] ${taskId} ${event.node.req.method} ${rawTargetPath} → dev-server:${devServer.port}`)

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
        const statusCode = proxyRes.statusCode || 200

        const headers = { ...proxyRes.headers }

        delete headers['x-frame-options']
        delete headers['X-Frame-Options']
        delete headers['content-security-policy']
        delete headers['Content-Security-Policy']

        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          const location = headers.location as string
          if (location.startsWith('/') && !location.startsWith(proxyPrefix)) {
            headers.location = `${proxyPrefix}${location}`
            console.log(`[preview-proxy] Rewrote redirect Location from ${location} to ${headers.location}`)
          }
        }

        if (isTextResponse(proxyRes.headers)) {
          const chunks: Buffer[] = []

          proxyRes.on('data', (chunk: Buffer) => {
            chunks.push(chunk)
          })

          proxyRes.on('end', () => {
            if (statusCode >= 400 && looksLikeAsset(targetPath)) {
              if (tryServeFilesystemFallback(targetPath, devServer.worktreeDir, res)) {
                console.log(`[preview-proxy] ${taskId} dev-server returned ${statusCode} for ${targetPath}, filesystem fallback succeeded`)
                resolve()
                return
              }
            }

            let body = Buffer.concat(chunks).toString('utf-8')
            body = rewriteAssetUrls(body, proxyPrefix)

            const modifiedBody = Buffer.from(body, 'utf-8')

            headers['content-length'] = String(modifiedBody.length)
            headers['cache-control'] = 'no-store'

            if (statusCode >= 400) {
              console.error(`[preview-proxy] ${taskId} dev-server ${fullTargetPath} returned ${statusCode} (text, ${modifiedBody.length} bytes)`)
            }

            res.writeHead(statusCode, headers)
            res.end(modifiedBody)
            resolve()
          })

          proxyRes.on('error', (err) => {
            console.error(`[preview-proxy] Response error for ${taskId}:`, err.message)
            reject(err)
          })
        } else {
          if (statusCode >= 400 && looksLikeAsset(targetPath)) {
            proxyRes.destroy()
            if (tryServeFilesystemFallback(targetPath, devServer.worktreeDir, res)) {
              console.log(`[preview-proxy] ${taskId} dev-server returned ${statusCode} for ${targetPath}, filesystem fallback succeeded`)
              resolve()
              return
            }
          }

          if (statusCode >= 400) {
            console.error(`[preview-proxy] ${taskId} dev-server ${fullTargetPath} returned ${statusCode} (binary)`)
          }

          res.writeHead(statusCode, headers)
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

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq)
    } else {
      proxyReq.end()
    }
  })
}
