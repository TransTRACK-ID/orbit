import http from 'http'
import handler from 'serve-handler'

export function createStaticServer(outputDir: string, port: number): http.Server {
  const server = http.createServer((req, res) => {
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

  server.listen(port, '127.0.0.1')
  return server
}
