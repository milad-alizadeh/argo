// The active roster merges rows from every CLI adapter (#2025), so one reply's cursor is not one
// adapter's own but a small map of them (#2239): each adapter pages its own window independently,
// and the wire cursor is the opaque encoding of all of them together. A caller never reads inside
// it — it only ever echoes a cursor a reply already gave it back on the next request.
export type RosterCursorMap = Record<string, string | null>

export function decodeRosterCursor(cursor: string | null | undefined): RosterCursorMap {
  if (cursor === null || cursor === undefined) return {}
  try {
    const decoded = JSON.parse(cursor)
    return typeof decoded === 'object' && decoded !== null ? (decoded as RosterCursorMap) : {}
  } catch {
    return {}
  }
}

// `null` once no adapter has more, so a reply with nothing further to read says so plainly rather
// than handing back an opaque cursor that would only ever be echoed to the same effect.
export function encodeRosterCursor(cursors: RosterCursorMap): string | null {
  if (Object.values(cursors).every((value) => value === null)) return null
  return JSON.stringify(cursors)
}
