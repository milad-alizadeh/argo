import type { TranscriptDiscovery } from './discover-transcript-sessions'
import type { SessionRosterRow, SessionTitle } from './models'

type ReconciliationSource = 'held' | 'observed'

export const sessionRosterReconciliation = {
  id: 'observed',
  retiredIds: 'observed',
  cli: 'observed',
  posture: 'held',
  title: 'held',
  status: 'observed',
  entry: 'observed',
  cwd: 'observed',
  branch: 'observed',
  updatedAt: 'observed',
  unreadableLines: 'observed',
  originUnread: 'observed',
  turnStartedAt: 'observed',
  activity: 'observed',
  plan: 'observed',
  delegations: 'observed',
  shell: 'observed',
  pullRequest: 'observed',
  archived: 'observed',
  contextTokens: 'observed',
  spentTokens: 'observed',
  compactionStartedAt: 'held',
  compactionPercentage: 'held',
  compactionTokens: 'held',
  setup: 'observed',
} as const satisfies Record<keyof SessionRosterRow, ReconciliationSource>

function reconcileManagedRow(observed: SessionRosterRow, held: SessionRosterRow): SessionRosterRow {
  return Object.fromEntries(
    (
      Object.entries(sessionRosterReconciliation) as [
        keyof SessionRosterRow,
        ReconciliationSource,
      ][]
    ).map(([field, source]) => [field, source === 'held' ? held[field] : observed[field]]),
  ) as SessionRosterRow
}

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
    title?: SessionTitle
  },
): SessionRosterRow {
  return {
    id,
    retiredIds: [],
    cli: session.cli,
    posture: 'managed',
    title: session.title ?? { text: session.prompt, source: 'first-prompt' },
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
// discovery sweep alone can miss it, or hold a stale posture for one it has already found. `running`
// is not reachable from the transcript's own external reading (status.ts), which floors an open or
// ambiguous Turn at `unknown` — so a managed row disambiguates only there, and its `permission`
// status always wins since nothing external can produce it. A definite external reading (`idle`,
// `asking`, `stopped`) is never overridden by the managed row's `running` just because it is held.
export function mergeManagedRoster(
  discovered: TranscriptDiscovery,
  managed: SessionRosterRow[],
  reconcile = reconcileManagedRow,
): TranscriptDiscovery {
  const managedById = new Map(managed.map((session) => [session.id, session]))
  const observed = discovered.rows.map((session) => {
    const held = managedById.get(session.id)
    if (held === undefined) return session
    const status =
      held.status === 'permission' || session.status === 'unknown' ? held.status : session.status
    return reconcile({ ...session, posture: held.posture, status }, held)
  })
  const unobserved = managed.filter(
    (session) => !discovered.rows.some(({ id }) => id === session.id),
  )
  return { ...discovered, rows: [...observed, ...unobserved] }
}
