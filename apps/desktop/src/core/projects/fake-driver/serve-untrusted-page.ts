import assert from 'node:assert/strict'
import { createServer } from 'node:http'

export async function serveUntrustedPage(message: unknown) {
  let reply: (value: unknown) => void = () => undefined
  const received = new Promise<unknown>((resolve) => {
    reply = resolve
  })
  const server = createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/reply') {
      let body = ''
      request.setEncoding('utf8')
      request.on('data', (chunk) => {
        body += chunk
      })
      request.once('end', () => {
        reply(JSON.parse(body))
        response.end()
      })
      return
    }
    response.end(`<script>
      window.argo.openProject(${JSON.stringify(message)}).then((reply) =>
        fetch('/reply', { method: 'POST', body: JSON.stringify(reply) }),
      )
    </script>`)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return { received, server, url: `http://127.0.0.1:${address.port}` }
}
