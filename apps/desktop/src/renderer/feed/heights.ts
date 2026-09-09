// Argo's own height store. ADR-0033 rule 6 names the only three things that invalidate a cached
// height — width, font and zoom — so the key carries all three beside the Session.
//
// The row set is the fourth thing, and it WIDENS rule 6 rather than following it. A transcript
// grows while Argo is looking at it, so one Session at one width is a different document an hour
// later; keyed without the rows, a second open hits the cache and hands back a map that has never
// heard of the new ones, and a row with no height in the map is a row Blink lays out. Rule 5 names
// the other route — measure an appended row and insert it, holding the scroll — and this slice
// does not take it, because nothing here watches the transcripts and growth only ever surfaces on
// a reopen, which rules 3 and 4 already govern. A live-growth slice still owes rule 5.
//
// The digest is a key PART, not a second key: one Session at one width holds one map, and a new
// row set replaces it. Keying the outer map on the digest too would leave every superseded map in
// the store for the length of the launch, one per append.

export type Reading = {
  sessionId: string
  rowsDigest: string
  width: number
  font: string
  zoom: number
}

const DIGEST_OFFSET = 0x811c9dc5
const DIGEST_PRIME = 0x01000193

// The row set, as one short string. Row ids carry the record's uuid and the block's place in it,
// and a transcript is appended to rather than rewritten in place, so the ids stand for the rows.
// The count is written out beside the hash rather than folded into it, so two row sets of
// different lengths can never meet whatever their ids fold to.
export function digestOfRows(ids: readonly string[]): string {
  let hash = DIGEST_OFFSET
  for (const id of ids) {
    for (let index = 0; index < id.length; index += 1) {
      hash = Math.imul(hash ^ id.charCodeAt(index), DIGEST_PRIME)
    }
    // A boundary between ids, so two different lists cannot fold to one stream.
    hash = Math.imul(hash, DIGEST_PRIME)
  }
  return `${ids.length}:${(hash >>> 0).toString(36)}`
}

function keyOf(reading: Reading): string {
  return [reading.sessionId, reading.width, reading.font, reading.zoom].join('|')
}

export function createHeightStore() {
  const settled = new Map<string, { rowsDigest: string; heights: Map<string, number> }>()
  return {
    read(reading: Reading): Map<string, number> | null {
      const held = settled.get(keyOf(reading))
      return held !== undefined && held.rowsDigest === reading.rowsDigest ? held.heights : null
    },
    write(reading: Reading, heights: Map<string, number>): void {
      settled.set(keyOf(reading), { rowsDigest: reading.rowsDigest, heights })
    },
  }
}
