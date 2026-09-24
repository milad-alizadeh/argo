import type { LaunchDiscovery, PendingSessionLaunch } from './session-identity-service'

const LAUNCH_DISCOVERY_WINDOW_MS = 120_000

export function discoverStartedSession(
  intent: PendingSessionLaunch,
  candidates: readonly {
    nativeId: string
    workspaceId: string
    firstPrompt: string | null
    startedAt: number
  }[],
): LaunchDiscovery {
  const matches = candidates.filter(
    (candidate) =>
      candidate.workspaceId === intent.workspaceId &&
      candidate.firstPrompt === intent.prompt &&
      candidate.startedAt >= intent.createdAt - LAUNCH_DISCOVERY_WINDOW_MS &&
      candidate.startedAt <= intent.createdAt + LAUNCH_DISCOVERY_WINDOW_MS,
  )
  return matches.length === 1 && matches[0] !== undefined
    ? { kind: 'found', nativeId: matches[0].nativeId }
    : { kind: 'ambiguous' }
}
