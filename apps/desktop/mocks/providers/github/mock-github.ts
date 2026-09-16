// GitHub, as far as the cockpit calls it, on a fixed loopback origin, answered by Mock Service
// Worker instead of a real socket. The provider is the one thing a test here does not control and
// cannot afford live, so it is the one thing mockd; only this in-process suite drives it — the
// packaged proof keeps its own real loopback server, since Mock Service Worker cannot reach a
// process it was never loaded into.
import { mountMockProvider, type NodeRoute } from '../msw-node-bridge'
import type { MockState } from './mock-exchange'
import { githubControls } from './mock-github-controls'
import { answer } from './mock-routes'

export type MockUser = { id: number; login: string }

export type MockIssue = {
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

export type MockRepository = {
  fullName: string
  hasIssues?: boolean
  // GitHub ids of the users who can see the repository.
  visibleTo: number[]
  // GitHub ids of the users who can change its issues; everyone who can see it when absent.
  writers?: number[]
  issues: MockIssue[]
  // A repository whose owner has no dependency facts serves no dependency summary at all.
  servesDependencies?: boolean
}

// Who answers the next device code, and how.
export type MockSignIn = MockUser | 'declined' | 'expired'

export type MockOutage = 'none' | 'rate-limited' | 'down'

export type MockGitHub = {
  origin: string
  // Every request path the server answered, in order.
  requests: string[]
  signIn(answer: MockSignIn, pendingPolls?: number): void
  // The next sign-in waits until the device page is opened.
  holdSignIn(answer: MockSignIn): void
  addRepository(repository: MockRepository): void
  revoke(login: string): void
  outage(kind: MockOutage): void
  close(): Promise<void>
}

// A fixed loopback-shaped origin, never actually dialed: Mock Service Worker intercepts a request
// to it before any socket opens, so nothing needs to bind a free port.
const MOCK_GITHUB_ORIGIN = 'http://127.0.0.1:41200'

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

export async function startMockGitHub(): Promise<MockGitHub> {
  const requests: string[] = []
  const state: MockState = {
    origin: MOCK_GITHUB_ORIGIN,
    signIn: { answer: 'declined', pending: 0, held: false },
    devices: new Map(),
    tokens: new Map(),
    repositories: new Map(),
    outage: 'none',
    serial: 0,
  }
  const route: NodeRoute = (request, response) => answer(state, request, response)
  const routes = Object.fromEntries(ROUTES.map((key) => [key, route]))
  const retire = mountMockProvider({ origin: MOCK_GITHUB_ORIGIN, requests, routes })
  return {
    origin: state.origin,
    requests,
    ...githubControls(state),
    close: async () => {
      retire()
    },
  }
}
