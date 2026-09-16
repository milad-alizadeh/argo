// Growing every adapter's bounded discovery window until the archive readings have what they
// need (#2315). Both archive calls face the same problem: the row they want — an archived
// Session, or the Session a caller named by id — can sit outside the page the Roster loads, and
// only the chain-stitched parse says which id a row has retired. So each reading grows the same
// window `discoverSessions` pages by, one step at a time, and stops as soon as it is satisfied
// rather than reading the whole tree.
import type { SessionRosterRow } from './models'
import type { RosterCursorMap } from './roster-cursor'
import type { SessionSource } from './session-source'

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
  const discoveries = await Promise.all(
    sources.map(async (source) => ({
      cli: source.cli,
      read: await source
        .discoverSessions({ cursor: windows[source.cli] ?? null, projectRoot: null })
        .catch(() => null),
    })),
  )
  const next: RosterCursorMap = Object.fromEntries(
    discoveries.map(({ cli, read }) => [cli, read?.nextCursor ?? null]),
  )
  const window: SessionWindow = {
    rows: discoveries
      .flatMap(({ read }) => read?.rows ?? [])
      .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')),
    windows,
    exhausted: Object.values(next).every((cursor) => cursor === null),
  }
  return { window, next: grownWindows(windows, next) }
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
