// The one set of control methods both fake Linear transports (Mock Service Worker and the real
// loopback socket the packaged proof needs) expose over the same `FakeLinearState`.
import type { FakeLinear, FakeLinearUser } from './fake-linear'
import type { FakeLinearState } from './fake-linear-state'

export function linearControls(
  state: FakeLinearState,
): Omit<FakeLinear, 'origin' | 'requests' | 'close'> {
  const forUser = (userId: string, map: Map<string, { user: FakeLinearUser }>) => {
    for (const [key, grant] of map) if (grant.user.id === userId) map.delete(key)
  }
  return {
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
  }
}
