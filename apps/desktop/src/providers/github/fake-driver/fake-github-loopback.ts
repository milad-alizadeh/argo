// GitHub answered on a real loopback socket, for the packaged proof: it launches the shipped app
// as a separate OS process, and Mock Service Worker patches only the process that loads it, so the
// in-process handlers in `fake-github.ts` cannot reach it (#2323). `fake-routes.ts` is the one
// dispatcher both transports call; only the socket differs.
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type FakeState, send } from './fake-exchange'
import type { FakeGitHub } from './fake-github'
import { githubControls } from './fake-github-controls'
import { answer } from './fake-routes'

export async function startFakeGitHubLoopback(): Promise<FakeGitHub> {
  const requests: string[] = []
  const state: FakeState = {
    origin: '',
    signIn: { answer: 'declined', pending: 0, held: false },
    devices: new Map(),
    tokens: new Map(),
    repositories: new Map(),
    outage: 'none',
    serial: 0,
  }
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${new URL(request.url ?? '/', 'http://x').pathname}`)
    answer(state, request, response).catch(() => send(response, 500, { message: 'Fake failed' }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  state.origin = `http://127.0.0.1:${port}`
  return {
    origin: state.origin,
    requests,
    ...githubControls(state),
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
