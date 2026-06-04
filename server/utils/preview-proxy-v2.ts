import http from 'http'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'
import { requireAuth } from './auth'
import { isPreviewStatic } from './preview-orchestrator'

function getNavigationInterceptionScript(instanceId: string): string {
  const baseUrl = `/api/preview/${instanceId}/`
  return `
<script>
(function() {
  const baseUrl = '${baseUrl}';
  
  function patchUrl(url) {
    if (typeof url !== 'string') return url;
    if (url.startsWith('/') && !url.startsWith(baseUrl) && !url.startsWith('//')) {
      return baseUrl + url.replace(/^\/+/g, '');
    }
    return url;
  }
  
  // Intercept location.href
  try {
    const origHref = Object.getOwnPropertyDescriptor(window.location, 'href');
    if (origHref && origHref.set) {
      Object.defineProperty(window.location, 'href', {
        set: function(url) { return origHref.set.call(this, patchUrl(url)); },
        get: function() { return origHref.get.call(this); }
      });
    }
  } catch (e) {}
  
  // Intercept location.replace
  try {
    const origReplace = window.location.replace;
    window.location.replace = function(url) {
      return origReplace.call(this, patchUrl(url));
    };
  } catch (e) {}
  
  // Intercept location.assign
  try {
    const origAssign = window.location.assign;
    window.location.assign = function(url) {
      return origAssign.call(this, patchUrl(url));
    };
  } catch (e) {}
})();
</script>
`
}

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
          // Disable compression so we can inject scripts into HTML responses
          'accept-encoding': 'identity',
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
        const location = proxyRes.headers['location']
        if (location && typeof location === 'string') {
          // For static previews, Nitro doesn't prepend base URL to redirects
          // so we need to add the /api/preview/{id} prefix
          if (isStatic && location.startsWith('/') && !location.startsWith(`/api/preview/${instanceId}`)) {
            proxyRes.headers['location'] = `/api/preview/${instanceId}${location}`
            console.log(`[preview-proxy] Rewrote Location: ${location} → ${proxyRes.headers['location']}`)
          }
          // For SSR, Nitro already prepends base URL to redirects
          // so Location headers are already correct
        }

        // Rewrite Set-Cookie paths for static previews only
        // SSR Nitro handles cookie paths correctly with baseURL
        if (isStatic) {
          const setCookie = proxyRes.headers['set-cookie']
          if (setCookie) {
            proxyRes.headers['set-cookie'] = setCookie.map((cookie: string) => {
              return cookie
                .replace(/Path=\//g, `Path=/api/preview/${instanceId}/`)
                .replace(/Path=\/api\//g, `Path=/api/preview/${instanceId}/api/`)
            })
          }
        }

        // Check if response is HTML and inject navigation interception script
        const contentType = proxyRes.headers['content-type'] || ''
        const isHtml = typeof contentType === 'string' && contentType.includes('text/html')

        if (isHtml && proxyRes.statusCode && proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
          let body = ''
          proxyRes.setEncoding('utf8')
          proxyRes.on('data', (chunk: string) => { body += chunk })
          proxyRes.on('end', () => {
            const script = getNavigationInterceptionScript(instanceId)
            
            // Inject script before </head> or after <head> or at the beginning
            if (body.includes('</head>')) {
              body = body.replace('</head>', script + '</head>')
            } else if (body.includes('<head>')) {
              body = body.replace('<head>', '<head>' + script)
            } else if (body.includes('<html')) {
              body = body.replace(/<html[^>]*>/i, '$&' + script)
            } else {
              body = script + body
            }
            
            // Update content-length
            const responseHeaders = { ...proxyRes.headers }
            responseHeaders['content-length'] = Buffer.byteLength(body)
            delete responseHeaders['transfer-encoding']
            
            res.writeHead(proxyRes.statusCode || 200, responseHeaders)
            res.end(body)
            resolve()
          })
          proxyRes.on('error', reject)
        } else {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
          proxyRes.pipe(res)
          proxyRes.on('end', resolve)
          proxyRes.on('error', reject)
        }
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
