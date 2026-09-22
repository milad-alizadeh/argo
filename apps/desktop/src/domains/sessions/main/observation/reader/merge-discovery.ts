// Combining every Harness source's discovery into one Roster reply (#2025).
import {
  type SessionError,
  type SessionListReply,
  sessionError,
} from '@/domains/sessions/contract/ipc'
import { encodeRosterCursor, type RosterCursorMap } from '../../projection/roster/roster-cursor'
import type { TranscriptDiscovery } from './discover-transcript-sessions'

export type Discovered = TranscriptDiscovery | { error: SessionError }

export function isDiscoveryError(discovered: Discovered): discovered is { error: SessionError } {
  return 'error' in discovered
}

// Today's aggregation, kept: the Sessions and counts of every adapter that answered, and the
// first adapter's error only when every adapter failed. `clis` is `discovered`'s own sources, in
// the same order, so each adapter's `nextCursor` can be named in the merged cursor (#2239) without
// `TranscriptDiscovery` itself needing to carry the adapter's name.
export function combineDiscoveries(
  discovered: Discovered[],
  clis: readonly string[],
  requestId: string,
): SessionListReply {
  const successful = discovered.filter(
    (reading): reading is TranscriptDiscovery => !isDiscoveryError(reading),
  )
  if (successful.length === 0) {
    const first = discovered[0]
    return first !== undefined && isDiscoveryError(first)
      ? first.error
      : sessionError('internal-error', requestId)
  }
  const cursors: RosterCursorMap = {}
  for (const [index, reading] of discovered.entries()) {
    const harness = clis[index]
    if (harness !== undefined && !isDiscoveryError(reading)) cursors[harness] = reading.nextCursor
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
    filesParsed: successful.reduce((total, reading) => total + reading.filesParsed, 0),
    nextCursor: encodeRosterCursor(cursors),
    // False the moment any adapter's older history is still backfilling (#2373), so the reply
    // never claims a Session index still catching up already holds the whole machine.
    historyComplete: successful.every((reading) => reading.historyComplete),
  }
}
