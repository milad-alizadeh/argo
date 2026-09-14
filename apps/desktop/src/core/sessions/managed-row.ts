import type { TranscriptDiscovery } from './discover-transcript-sessions'
import type { SessionRosterRow } from './models'

// The row a managed Session stands on before its transcript says anything; `setup` is what Argo applied.
export function managedRow(
  id: string,
  session: Pick<SessionRosterRow, 'cli' | 'cwd' | 'status' | 'setup'> & {
    prompt: string
    startedAt: string
  },
): SessionRosterRow {
  return {
    id,
    retiredIds: [],
    cli: session.cli,
    posture: 'managed',
    title: { text: session.prompt, source: 'first-prompt' },
    status: session.status,
    entry: 'interactive',
    cwd: session.cwd,
    branch: null,
    // The start time sorts a new Session to the top of the Roster until its transcript has one (#2002).
    updatedAt: session.startedAt,
    unreadableLines: 0,
    originUnread: false,
    turnStartedAt: null,
    activity: null,
    plan: null,
    delegations: [],
    shell: [],
    pullRequest: null,
    archived: false,
    contextTokens: null,
    spentTokens: null,
    setup: session.setup,
  }
}

// A managed Session is driven in memory before its CLI ever writes a transcript, so an adapter's
// discovery sweep alone can miss it, or hold a stale posture for one it has already found. `running`
// is not reachable from the transcript's own external reading (status.ts), which floors an open or
// ambiguous Turn at `unknown` — so a managed row disambiguates only there, and its `permission`
// status always wins since nothing external can produce it. A definite external reading (`idle`,
// `asking`, `stopped`) is never overridden by the managed row's `running` just because it is held.
export function mergeManagedRoster(
  discovered: TranscriptDiscovery,
  managed: SessionRosterRow[],
): TranscriptDiscovery {
  const managedById = new Map(managed.map((session) => [session.id, session]))
  const observed = discovered.rows.map((session) => {
    const held = managedById.get(session.id)
    if (held === undefined) return session
    const status =
      held.status === 'permission' || session.status === 'unknown' ? held.status : session.status
    return { ...session, posture: held.posture, status }
  })
  const unobserved = managed.filter(
    (session) => !discovered.rows.some(({ id }) => id === session.id),
  )
  return { ...discovered, rows: [...observed, ...unobserved] }
}
