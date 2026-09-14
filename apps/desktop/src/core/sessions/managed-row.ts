import type { TranscriptDiscovery } from './discover-transcript-sessions'
import type { SessionRosterRow } from './models'

// The row a managed Session stands on before its transcript says anything; `setup` is what Argo applied.
export function managedRow(
  id: string,
  session: Pick<
    SessionRosterRow,
    | 'cli'
    | 'compactionPercentage'
    | 'compactionStartedAt'
    | 'compactionTokens'
    | 'cwd'
    | 'status'
    | 'setup'
  > & {
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
    compactionStartedAt: session.compactionStartedAt,
    compactionPercentage: session.compactionPercentage,
    compactionTokens: session.compactionTokens,
    setup: session.setup,
  }
}

// A managed Session is driven in memory before its CLI ever writes a transcript, so an adapter's
// discovery sweep alone can miss it, or hold a stale posture for one it has already found.
export function mergeManagedRoster(
  discovered: TranscriptDiscovery,
  managed: SessionRosterRow[],
  reconcile = (observed: SessionRosterRow, held: SessionRosterRow) => ({
    ...observed,
    posture: held.posture,
  }),
): TranscriptDiscovery {
  const managedById = new Map(managed.map((session) => [session.id, session]))
  const observed = discovered.rows.map((session) => {
    const held = managedById.get(session.id)
    return held === undefined ? session : reconcile(session, held)
  })
  const unobserved = managed.filter(
    (session) => !discovered.rows.some(({ id }) => id === session.id),
  )
  return { ...discovered, rows: [...observed, ...unobserved] }
}
