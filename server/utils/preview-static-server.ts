import http from 'http'
import handler from 'serve-handler'

export function createStaticServer(outputDir: string, port: number): http.Server {
  const server = http.createServer((req, res) => {
    return handler(req, res, {
      public: outputDir,
      rewrites: [
        { source: '!**/*.@(js|css|png|jpg|jpeg|gif|svg|ico|woff2|woff|ttf|eot|map|json)', destination: '/index.html' }
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
