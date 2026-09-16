// GitHub, as far as the cockpit calls it, on a fixed loopback origin, answered by Mock Service
// Worker instead of a real socket. The provider is the one thing a test here does not control and
// cannot afford live, so it is the one thing faked; only this in-process suite drives it — the
// packaged proof keeps its own real loopback server, since Mock Service Worker cannot reach a
// process it was never loaded into.
import { mountFakeProvider, type NodeRoute } from '../../msw-node-bridge'
import type { FakeState } from './fake-exchange'
import { answer } from './fake-routes'

export type FakeUser = { id: number; login: string }

export type FakeIssue = {
  number: number
  title: string
  body?: string | null
  state?: 'open' | 'closed'
  stateReason?: 'completed' | 'not_planned' | 'duplicate' | null
  createdAt?: string
  labels?: { name: string; color: string }[]
  type?: string
  children?: number[]
  blockedBy?: number[]
  pullRequest?: boolean
}

export type FakeRepository = {
  fullName: string
  hasIssues?: boolean
  // GitHub ids of the users who can see the repository.
  visibleTo: number[]
  // GitHub ids of the users who can change its issues; everyone who can see it when absent.
  writers?: number[]
  issues: FakeIssue[]
  // A repository whose owner has no dependency facts serves no dependency summary at all.
  servesDependencies?: boolean
}

// Who answers the next device code, and how.
export type FakeSignIn = FakeUser | 'declined' | 'expired'

export type FakeOutage = 'none' | 'rate-limited' | 'down'

export type FakeGitHub = {
  origin: string
  // Every request path the server answered, in order.
  requests: string[]
  signIn(answer: FakeSignIn, pendingPolls?: number): void
  // The next sign-in waits until the device page is opened.
  holdSignIn(answer: FakeSignIn): void
  addRepository(repository: FakeRepository): void
  revoke(login: string): void
  outage(kind: FakeOutage): void
  close(): Promise<void>
}

// A fixed loopback-shaped origin, never actually dialed: Mock Service Worker intercepts a request
// to it before any socket opens, so nothing needs to bind a free port.
const FAKE_GITHUB_ORIGIN = 'http://127.0.0.1:41200'

// The concrete request shapes the cockpit sends GitHub. Anything else on this origin is a call the
// test never meant to stub, and Mock Service Worker aborts it by name rather than answer a quiet 404.
const ROUTES = [
  'POST /login/device/code',
  'POST /login/oauth/access_token',
  'GET /login/device',
  'GET /user',
  'GET /search/issues',
  'GET /user/repos',
  'GET /repos/:owner/:repo',
  'GET /repos/:owner/:repo/issues',
  'GET /repos/:owner/:repo/issues/:number/sub_issues',
  'GET /repos/:owner/:repo/issues/:number/dependencies/blocked_by',
  'PATCH /repos/:owner/:repo/issues/:number',
]

export async function startFakeGitHub(): Promise<FakeGitHub> {
  const requests: string[] = []
  const state: FakeState = {
    origin: FAKE_GITHUB_ORIGIN,
    signIn: { answer: 'declined', pending: 0, held: false },
    devices: new Map(),
    tokens: new Map(),
    repositories: new Map(),
    outage: 'none',
    serial: 0,
  }
  let closed = false
  const route: NodeRoute = (request, response) => answer(state, request, response)
  const routes = Object.fromEntries(ROUTES.map((key) => [key, route]))
  mountFakeProvider(FAKE_GITHUB_ORIGIN, () => !closed, requests, routes)
  return {
    origin: state.origin,
    requests,
    signIn(answer, pendingPolls = 1) {
      state.signIn = { answer, pending: pendingPolls, held: false }
    },
    holdSignIn(answer) {
      state.signIn = { answer, pending: 0, held: true }
    },
    addRepository(repository) {
      state.repositories.set(repository.fullName.toLowerCase(), repository)
    },
    revoke(login) {
      for (const [token, user] of state.tokens) if (user.login === login) state.tokens.delete(token)
    },
    outage(kind) {
      state.outage = kind
    },
    close: async () => {
      closed = true
    },
  }
}
