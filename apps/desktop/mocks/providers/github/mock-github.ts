// GitHub, as far as the cockpit calls it, on a loopback port. The provider is the one thing a test
// here does not control and cannot afford live, so it is the one thing mockd: the unit tests and
// the packaged proof both drive this server, and both leave the cockpit's own code running for real.
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { type MockState, send } from './mock-exchange'
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

export async function startMockGitHub(): Promise<MockGitHub> {
  const requests: string[] = []
  const state: MockState = {
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
    answer(state, request, response).catch(() => send(response, 500, { message: 'Mock failed' }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  state.origin = `http://127.0.0.1:${port}`
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
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
