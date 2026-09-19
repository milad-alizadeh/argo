import type { SessionRosterRow, SessionTitle } from '@/domains/sessions/contract/models'
import { TITLE_SOURCES } from '@/domains/sessions/contract/models'
import {
  type ManagedRosterSeed,
  managedRosterRow,
  reconcileRosterRow,
} from '@/domains/sessions/contract/roster-row-definition'
import type { TranscriptDiscovery } from '@/domains/sessions/main/discover-transcript-sessions'
import { rollupSessionStatus } from '@/domains/sessions/main/session-status-rollup'

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
  return reconcileRosterRow(observed, held, () => strongerTitle(observed, held))
}

// The row a managed Session stands on before its transcript says anything; `setup` is what Argo applied.
export function managedRow(id: string, session: ManagedRosterSeed['session']): SessionRosterRow {
  return managedRosterRow({ id, session: { ...session, plan: session.plan ?? null } })
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
    const status = rollupSessionStatus(session.status, held.posture, held.status)
    return reconcile({ ...session, posture: held.posture, status }, held)
  })
  const unobserved = managed.filter(
    (session) => !discovered.rows.some(({ id }) => id === session.id),
  )
  return { ...discovered, rows: [...observed, ...unobserved] }
}
