// Growing every adapter's bounded discovery window until an archive reading has what it needs
// (#2315). The row an archive call wants — an archived Session, or the Session a caller named by
// id — can sit outside the page the Roster loads, and only the chain-stitched parse says which
// ids a row has retired. So a reading grows the same window `discoverSessions` pages by, one step
// at a time, and stops as soon as its own predicate is satisfied. A predicate no row can satisfy
// grows to the whole tree, which is what restoring an id that is no longer on disk costs.
import { sessionError } from '@/domains/sessions/contract/contract'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import { combineDiscoveries, type Discovered } from './merge-discovery'
import { readFailure } from './read-declaration'
import { decodeRosterCursor, type RosterCursorMap } from './roster-cursor'
import type { SessionSource } from './session-source'

// The merged reply below needs a request id for its error case, which no caller ever reads: an
// archive reading answers under its own request id, in its own envelope.
const WINDOW_READ = 'archive-window'

export type SessionWindow = {
  rows: SessionRosterRow[]
  // What was asked of each adapter to read these rows. A later call echoes it to read the same
  // window again rather than starting over at the first page.
  windows: RosterCursorMap
  // Every adapter has read every file it found, so no further growth can add a row.
  exhausted: boolean
}

// An adapter that has read everything answers `nextCursor: null`, and passing that back would
// reset its window to the first page. So an exhausted adapter keeps the window it already holds.
function grownWindows(windows: RosterCursorMap, next: RosterCursorMap): RosterCursorMap {
  return Object.fromEntries(
    Object.entries(next).map(([cli, cursor]) => [cli, cursor ?? windows[cli] ?? null]),
  )
}

async function readWindow(sources: readonly SessionSource[], windows: RosterCursorMap) {
  const discovered: Discovered[] = await Promise.all(
    sources.map((source) =>
      source
        .discoverSessions({ cursor: windows[source.cli] ?? null, projectRoot: null })
        .catch((error: unknown) => ({ error: sessionError(readFailure(error), WINDOW_READ) })),
    ),
  )
  // The Roster's own merge, so the archive page holds the rows in the order the active list
  // holds them and reads one cursor per adapter the same way (#2025, #2239).
  const merged = combineDiscoveries(discovered, Object.values(sources).map(cliOf), WINDOW_READ)
  const listed = merged.type === 'session.listed' ? merged : null
  const window: SessionWindow = {
    rows: listed?.sessions ?? [],
    windows,
    exhausted: listed === null || listed.nextCursor === null,
  }
  return { window, next: grownWindows(windows, decodeRosterCursor(listed?.nextCursor ?? null)) }
}

function cliOf(source: SessionSource) {
  return source.cli
}

// Reads the window `windows` names, then grows it a page at a time until `satisfied` says the
// reading has what it needs or every adapter has read every file it found.
export async function growWindow(
  sources: readonly SessionSource[],
  windows: RosterCursorMap,
  satisfied: (rows: SessionRosterRow[]) => boolean,
): Promise<SessionWindow> {
  let read = await readWindow(sources, windows)
  while (!read.window.exhausted && !satisfied(read.window.rows)) {
    read = await readWindow(sources, read.next)
  }
  return read.window
}
