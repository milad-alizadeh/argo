// Combining every CLI source's discovery into one Roster reply, and folding in a driver's managed
// Sessions before its transcript exists (#2025).
import { type SessionError, type SessionListReply, sessionError } from './contract'
import type { TranscriptDiscovery } from './discover-transcript-sessions'
import type { SessionRosterRow } from './models'

export type Discovered = TranscriptDiscovery | { error: SessionError }

// A managed Session is driven in memory before its CLI ever writes a transcript, so a sweep alone
// can miss it, or hold a stale status for one it has already found. The managed side sets the
// posture always, and the status only while the driver reports `permission`: a driver's managed
// row says `running` for every Session it holds, idle or not, so anything else it might say must
// not override what the transcript itself found.
export function mergeManagedRoster(
  discovered: TranscriptDiscovery,
  managed: SessionRosterRow[],
): TranscriptDiscovery {
  const managedById = new Map(managed.map((session) => [session.id, session]))
  const observed = discovered.rows.map((session) => {
    const held = managedById.get(session.id)
    if (held === undefined) return session
    const status = held.status === 'permission' ? 'permission' : session.status
    return { ...session, posture: held.posture, status }
  })
  const unobserved = managed.filter(
    (session) => !discovered.rows.some(({ id }) => id === session.id),
  )
  return { ...discovered, rows: [...observed, ...unobserved] }
}

export function isDiscoveryError(discovered: Discovered): discovered is { error: SessionError } {
  return 'error' in discovered
}

// Today's aggregation, kept: the Sessions and counts of every adapter that answered, and the
// first adapter's error only when every adapter failed.
export function combineDiscoveries(discovered: Discovered[], requestId: string): SessionListReply {
  const successful = discovered.filter(
    (reading): reading is TranscriptDiscovery => !isDiscoveryError(reading),
  )
  if (successful.length === 0) {
    const first = discovered[0]
    return first !== undefined && isDiscoveryError(first)
      ? first.error
      : sessionError('internal-error', requestId)
  }
  return {
    version: 1,
    type: 'session.listed',
    requestId,
    sessions: successful
      .flatMap((reading) => reading.rows)
      .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')),
    filesFound: successful.reduce((total, reading) => total + reading.filesFound, 0),
    filesRead: successful.reduce((total, reading) => total + reading.filesRead, 0),
    filesUnreadable: successful.reduce((total, reading) => total + reading.filesUnreadable, 0),
  }
}
