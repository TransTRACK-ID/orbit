import http from 'http'
import handler from 'serve-handler'

export function createStaticServer(outputDir: string, port: number): http.Server {
  console.log(`[preview-static-server] Creating static server for ${outputDir} on port ${port}`)
  
  const server = http.createServer((req, res) => {
    console.log(`[preview-static-server] Request: ${req.method} ${req.url}`)
    return handler(req, res, {
      public: outputDir,
      directoryListing: false,
      rewrites: [
        { source: '**', destination: '/index.html' }
      ],
      headers: [
        {
          source: '**',
          headers: [
            { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }
          ]
        }
      ]
    })
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(`[preview-static-server] Server listening on port ${port}`)
  })

  server.on('error', (err) => {
    console.error(`[preview-static-server] Server error on port ${port}:`, err)
  })

  return server
}
