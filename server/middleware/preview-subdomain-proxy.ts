import http from 'http'
import { getDb, schema } from '~/server/database'
import { eq } from 'drizzle-orm'

// Maps subdomain instanceId → port
const subdomainMap = new Map<string, number>()

export function registerPreviewSubdomain(instanceId: string, port: number) {
  subdomainMap.set(instanceId, port)
  console.log(`[preview-subdomain] Registered preview-${instanceId}.orbit.transtrack.ai → port ${port}`)
}

export function unregisterPreviewSubdomain(instanceId: string) {
  subdomainMap.delete(instanceId)
  console.log(`[preview-subdomain] Unregistered preview-${instanceId}.orbit.transtrack.ai`)
}

export function getPreviewSubdomainPort(instanceId: string): number | undefined {
  return subdomainMap.get(instanceId)
}

export default defineEventHandler(async (event) => {
  const host = getRequestHeader(event, 'host') || ''
  
  // Check if this is a preview subdomain
  // Format: preview-{instanceId}.orbit.transtrack.ai
  const match = host.match(/^preview-([a-f0-9-]+)\.orbit\.transtrack\.ai(:\d+)?$/)
  if (!match) return // Not a preview subdomain, pass through to normal Nuxt handling
  
  const instanceId = match[1]
  const port = subdomainMap.get(instanceId)
  
  if (!port) {
    // Preview not found in memory — try database fallback
    try {
      const db = getDb()
      const instance = await db.query.previewInstances.findFirst({
        where: eq(schema.previewInstances.id, instanceId),
      })
      
      if (instance && instance.status === 'running' && instance.port) {
        subdomainMap.set(instanceId, instance.port)
        console.log(`[preview-subdomain] Recovered from DB: preview-${instanceId}.orbit.transtrack.ai → port ${instance.port}`)
      } else {
        throw createError({ statusCode: 404, statusMessage: 'Preview not found or not running' })
      }
    } catch {
      throw createError({ statusCode: 404, statusMessage: 'Preview not found' })
    }
  }
  
  const finalPort = subdomainMap.get(instanceId)!
  const req = event.node.req
  const res = event.node.res
  
  console.log(`[preview-subdomain] proxying ${req.method} ${req.url} → localhost:${finalPort}`)
  
  return new Promise<void>((resolve, reject) => {
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: finalPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host, // Preserve original subdomain host
      },
      timeout: 30000,
    }, (proxyRes) => {
      // Forward response headers
      const headers = { ...proxyRes.headers }
      
      res.writeHead(proxyRes.statusCode || 200, headers)
      proxyRes.pipe(res)
      proxyRes.on('end', resolve)
      proxyRes.on('error', reject)
    })
    
    proxyReq.on('error', (err) => {
      console.error(`[preview-subdomain] Proxy error for ${instanceId}: ${err.message}`)
      if (!res.headersSent) {
        res.statusCode = 502
        res.end(`Preview error: ${err.message}`)
      }
      reject(err)
    })
    
    proxyReq.on('timeout', () => {
      proxyReq.destroy()
      if (!res.headersSent) {
        res.statusCode = 504
        res.end('Preview timeout')
      }
      reject(new Error('Timeout'))
    })
    
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq)
    } else {
      proxyReq.end()
    }
  })
})
