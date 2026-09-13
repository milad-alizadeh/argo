// Linear, as far as the cockpit calls it, on a loopback port: the consent page, the token endpoint
// and the GraphQL reads. The provider is the one thing a test here does not control and cannot
// afford live, so it is the one thing faked; the unit tests and the packaged proof both drive it.
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { answerGraphQL } from './fake-linear-graphql'
import { authorize, token } from './fake-linear-oauth'
import { type FakeLinearState, type Route, reply } from './fake-linear-state'

export type FakeLinearUser = { id: string; name: string; email: string; workspace: string }

export type FakeLinearIssue = {
  identifier: string
  title: string
  description?: string
  // Linear's workflow state: its own word, and the category that decides open or closed.
  status?: string
  stateType?: 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  priority?: 0 | 1 | 2 | 3 | 4
  createdAt?: string
  labels?: { name: string; color: string }[]
  children?: string[]
  blockedBy?: string[]
}

export type FakeLinearTeam = {
  id: string
  key: string
  name: string
  // Linear user ids that can see the team.
  visibleTo: string[]
  issues: FakeLinearIssue[]
}

// Who consents on the next authorize page. `held` leaves the page open with nobody answering.
export type FakeLinearSignIn = FakeLinearUser | 'declined' | 'held'

export type FakeLinearOutage = 'none' | 'rate-limited' | 'down'

export type FakeLinear = {
  origin: string
  // Every request the server answered, as method and path, in order.
  requests: string[]
  signIn(answer: FakeLinearSignIn): void
  addTeam(team: FakeLinearTeam): void
  // The lifetime of every access token issued from now on.
  tokenLifetime(seconds: number): void
  // This user's access tokens lapse now; their refresh tokens still renew.
  expire(userId: string): void
  // Every token issued to this user is refused: the person revoked Argo in Linear.
  revoke(userId: string): void
  // This user's refresh tokens are refused, as a grant left unused past its renewal.
  refuseRefresh(userId: string): void
  outage(kind: FakeLinearOutage): void
  close(): Promise<void>
}

const ROUTES: Record<string, Route> = {
  'GET /oauth/authorize': authorize,
  'POST /oauth/token': token,
  'POST /graphql': answerGraphQL,
}

export async function startFakeLinear(): Promise<FakeLinear> {
  const requests: string[] = []
  const state: FakeLinearState = {
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
      reply(response, 500, { error: 'fake_failed' }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  state.origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const forUser = (userId: string, map: Map<string, { user: FakeLinearUser }>) => {
    for (const [key, grant] of map) if (grant.user.id === userId) map.delete(key)
  }
  return {
    origin: state.origin,
    requests,
    signIn: (answer) => {
      state.signIn = answer
    },
    addTeam: (team) => {
      state.teams.set(team.id, team)
    },
    tokenLifetime: (seconds) => {
      state.lifetime = seconds
    },
    expire: (userId) => {
      for (const grant of state.access.values()) if (grant.user.id === userId) grant.expiresAt = 0
    },
    revoke: (userId) => {
      forUser(userId, state.access)
      forUser(userId, state.refresh)
    },
    refuseRefresh: (userId) => forUser(userId, state.refresh),
    outage: (kind) => {
      state.outage = kind
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
