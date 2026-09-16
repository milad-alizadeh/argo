// The one set of control methods both mock GitHub transports (Mock Service Worker and the real
// loopback socket the packaged proof needs) expose over the same `MockState`.
import type { MockState } from './mock-exchange'
import type { MockGitHub } from './mock-github'

export function githubControls(
  state: MockState,
): Omit<MockGitHub, 'origin' | 'requests' | 'close'> {
  return {
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
  }
}
