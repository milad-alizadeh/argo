// Linear answered on a real loopback socket, for the packaged proof: it launches the shipped app
// as a separate OS process, and Mock Service Worker patches only the process that loads it, so the
// in-process handlers in `mock-linear.ts` cannot reach it (#2323). The oauth and GraphQL dispatch
// functions are the one source both transports call; only the socket differs.
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { MockLinear } from './mock-linear'
import { linearControls } from './mock-linear-controls'
import { answerGraphQL } from './mock-linear-graphql'
import { authorize, token } from './mock-linear-oauth'
import { type MockLinearState, type Route, reply } from './mock-linear-state'

const ROUTES: Record<string, Route> = {
  'GET /oauth/authorize': authorize,
  'POST /oauth/token': token,
  'POST /graphql': answerGraphQL,
}

export async function startMockLinearLoopback(): Promise<MockLinear> {
  const requests: string[] = []
  const state: MockLinearState = {
    origin: '',
    signIn: 'declined',
    codes: new Map(),
    access: new Map(),
    refresh: new Map(),
    teams: new Map(),
    outage: 'none',
    lifetime: 86_399,
    serial: 0,
  }
  const server = createServer((request, response) => {
    const route = `${request.method} ${new URL(request.url ?? '/', 'http://x').pathname}`
    requests.push(route)
    const answer = ROUTES[route] ?? (() => reply(response, 404, { error: 'not_found' }))
    Promise.resolve(answer(state, request, response)).catch(() =>
      reply(response, 500, { error: 'mock_failed' }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  state.origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    origin: state.origin,
    requests,
    ...linearControls(state),
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
