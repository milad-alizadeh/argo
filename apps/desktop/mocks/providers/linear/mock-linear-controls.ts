// The one set of control methods both mock Linear transports (Mock Service Worker and the real
// loopback socket the packaged proof needs) expose over the same `MockLinearState`.
import type { MockLinear, MockLinearUser } from './mock-linear'
import type { MockLinearState } from './mock-linear-state'

export function linearControls(
  state: MockLinearState,
): Omit<MockLinear, 'origin' | 'requests' | 'close'> {
  const forUser = (userId: string, map: Map<string, { user: MockLinearUser }>) => {
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
