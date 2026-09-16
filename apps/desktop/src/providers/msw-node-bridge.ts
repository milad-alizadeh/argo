// The one Mock Service Worker server this process runs, and the plumbing that lets a fake
// provider keep answering with `node:http`'s `IncomingMessage`/`ServerResponse` instead of a
// Fetch-shaped rewrite. A second `setupServer()` instance silently steals the first one's
// interception of `fetch`, so every fake provider layers its routes onto this one instance rather
// than owning a server of its own; a test that runs two fakes at once (the Account harness) needs
// both alive together.
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { http, type HttpHandler } from 'msw'
import { setupServer } from 'msw/node'

export type NodeRoute = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<unknown> | unknown

async function bridge(request: Request, route: NodeRoute): Promise<Response> {
  const url = new URL(request.url)
  const body = Buffer.from(await request.arrayBuffer())
  const incoming = Readable.from(body.length ? [body] : []) as unknown as IncomingMessage
  incoming.method = request.method
  incoming.url = `${url.pathname}${url.search}`
  incoming.headers = Object.fromEntries(request.headers) as IncomingHttpHeaders

  let status = 200
  const headers = new Headers()
  const chunks: Buffer[] = []
  const response = {
    writeHead(code: number, headerBag?: Record<string, string>) {
      status = code
      for (const [key, value] of Object.entries(headerBag ?? {})) headers.set(key, String(value))
      return response
    },
    setHeader(key: string, value: string) {
      headers.set(key, value)
      return response
    },
    end(chunk?: string) {
      if (chunk) chunks.push(Buffer.from(chunk))
      return response
    },
  }
  await route(incoming, response as unknown as ServerResponse)
  return new Response(Buffer.concat(chunks), { status, headers })
}

const trackedOrigins = new Set<string>()
let server: ReturnType<typeof setupServer> | undefined

function theServer() {
  if (server) return server
  server = setupServer()
  server.listen({
    onUnhandledRequest(request, print) {
      // A request to a fake provider's own origin that matched no route is the silent-404 bug this
      // migration exists to catch. Anything else (a real loopback the app opened for itself, such
      // as the Argo-side OAuth redirect callback) reaches the real network untouched.
      if (trackedOrigins.has(new URL(request.url).origin)) print.error()
    },
  })
  return server
}

const METHODS = { get: http.get, post: http.post, patch: http.patch } as const

// Layers one fake provider's routes onto the shared server. `active` flips to `false` on the
// fake's own `close()`, so a later request to a closed fake falls through as unhandled rather than
// answer state a fresh fake, started under the same fixed origin, replaced.
export function mountFakeProvider(
  origin: string,
  active: () => boolean,
  requests: string[],
  routes: Record<string, NodeRoute>,
): void {
  trackedOrigins.add(origin)
  const handlers: HttpHandler[] = Object.entries(routes).map(([key, run]) => {
    const space = key.indexOf(' ')
    const method = key.slice(0, space).toLowerCase() as keyof typeof METHODS
    const path = key.slice(space + 1)
    return METHODS[method](`${origin}${path}`, async ({ request }) => {
      if (!active()) return
      requests.push(`${request.method} ${new URL(request.url).pathname}`)
      try {
        return await bridge(request, run)
      } catch {
        return Response.json({ error: 'fake_failed' }, { status: 500 })
      }
    })
  })
  theServer().use(...handlers)
}
