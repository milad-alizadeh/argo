import type { TranscriptDiscovery } from './discover-transcript-sessions'
import type { SessionRosterRow, SessionTitle } from './models'
import { TITLE_SOURCES } from './models'
import { rollupSessionStatus } from './session-status-rollup'

// `stronger-title` reads both rows and returns a title, so only `title` may carry it.
type ReconciliationSource<Field extends keyof SessionRosterRow> = Field extends 'title'
  ? 'held' | 'observed' | 'stronger-title'
  : 'held' | 'observed'

type SessionRosterReconciliation = {
  [Field in keyof SessionRosterRow]: ReconciliationSource<Field>
}

export const sessionRosterReconciliation = {
  id: 'observed',
  retiredIds: 'observed',
  cli: 'observed',
  posture: 'held',
  title: 'stronger-title',
  status: 'observed',
  entry: 'observed',
  cwd: 'observed',
  branch: 'observed',
  locked: 'observed',
  updatedAt: 'observed',
  unreadableLines: 'observed',
  originUnread: 'observed',
  turnStartedAt: 'observed',
  activity: 'observed',
  plan: 'observed',
  delegations: 'observed',
  shell: 'observed',
  pullRequest: 'observed',
  ticket: 'observed',
  archived: 'observed',
  contextTokens: 'observed',
  spentTokens: 'observed',
  compactionStartedAt: 'held',
  compactionPercentage: 'held',
  compactionTokens: 'held',
  handoffStartedAt: 'held',
  handoffFailure: 'held',
  handoffTo: 'observed',
  handoffFrom: 'observed',
  setup: 'observed',
} as const satisfies SessionRosterReconciliation

function titleRank(title: SessionTitle | null): number {
  return title === null ? TITLE_SOURCES.length : TITLE_SOURCES.indexOf(title.source)
}

// A managed row's title starts at the opening prompt, and discovery can find a stronger one: the
// name the CLI gave the thread, or a rename it has persisted. The held title wins a tie, so a
// rename Argo has applied outlives a sweep that has not caught up with it (#2256).
function strongerTitle(observed: SessionRosterRow, held: SessionRosterRow): SessionTitle | null {
  return titleRank(observed.title) < titleRank(held.title) ? observed.title : held.title
}

function reconcileManagedRow(observed: SessionRosterRow, held: SessionRosterRow): SessionRosterRow {
  const pick = {
    held: (field: keyof SessionRosterRow) => held[field],
    observed: (field: keyof SessionRosterRow) => observed[field],
    'stronger-title': () => strongerTitle(observed, held),
  } as const
  return Object.fromEntries(
    (
      Object.entries(sessionRosterReconciliation) as [keyof SessionRosterRow, keyof typeof pick][]
    ).map(([field, source]) => [field, pick[source](field)]),
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
    | 'handoffFailure'
    | 'handoffStartedAt'
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
    ticket: null,
    archived: false,
    contextTokens: null,
    spentTokens: null,
    compactionStartedAt: session.compactionStartedAt,
    compactionPercentage: session.compactionPercentage,
    compactionTokens: session.compactionTokens,
    handoffStartedAt: session.handoffStartedAt,
    handoffFailure: session.handoffFailure,
    handoffTo: null,
    handoffFrom: null,
    setup: session.setup,
  }
}

// A managed Session is driven in memory before its CLI ever writes a transcript, so an adapter's
// discovery sweep alone can miss it, or hold a stale posture for one it has already found. The
// tie-break between the discovered floor and the held row's own status is `session-status-rollup.ts`'s
// job, not this module's.
export function mergeManagedRoster(
  discovered: TranscriptDiscovery,
  managed: SessionRosterRow[],
  reconcile = reconcileManagedRow,
): TranscriptDiscovery {
  const managedById = new Map(managed.map((session) => [session.id, session]))
  const observed = discovered.rows.map((session) => {
    const held = managedById.get(session.id)
    if (held === undefined) return session
    const status = rollupSessionStatus(session.status, held.posture, {
      kind: 'already',
      status: held.status,
    })
    return reconcile({ ...session, posture: held.posture, status }, held)
  })
  const unobserved = managed.filter(
    (session) => !discovered.rows.some(({ id }) => id === session.id),
  )
  return { ...discovered, rows: [...observed, ...unobserved] }
}
