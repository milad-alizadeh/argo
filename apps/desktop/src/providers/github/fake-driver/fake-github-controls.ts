// The one set of control methods both fake GitHub transports (Mock Service Worker and the real
// loopback socket the packaged proof needs) expose over the same `FakeState`.
import type { FakeState } from './fake-exchange'
import type { FakeGitHub } from './fake-github'

export function githubControls(
  state: FakeState,
): Omit<FakeGitHub, 'origin' | 'requests' | 'close'> {
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
