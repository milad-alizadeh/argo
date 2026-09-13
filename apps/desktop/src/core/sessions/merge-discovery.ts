// Combining every CLI source's discovery into one Roster reply (#2025).
import { type SessionError, type SessionListReply, sessionError } from './contract'
import type { TranscriptDiscovery } from './discover-transcript-sessions'

export type Discovered = TranscriptDiscovery | { error: SessionError }

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
