// Argo's own height store. ADR-0033 rule 6 names the only three things that invalidate a cached
// height — width, font and zoom — so the key carries all three beside the Session.
//
// The Feed revision is the fourth key part. A transcript can grow while Argo is looking at it, so
// one Session at one width can name a different document seconds later. It replaces the old map
// for that Session and geometry reading rather than retaining one map per streamed update.

export type Reading = {
  sessionId: string
  revision: string
  width: number
  font: string
  zoom: number
}

function keyOf(reading: Reading): string {
  return [reading.sessionId, reading.width, reading.font, reading.zoom].join('|')
}

export function createHeightStore() {
  const settled = new Map<string, { revision: string; heights: Map<string, number> }>()
  return {
    read(reading: Reading): Map<string, number> | null {
      const held = settled.get(keyOf(reading))
      return held !== undefined && held.revision === reading.revision ? held.heights : null
    },
    write(reading: Reading, heights: Map<string, number>): void {
      settled.set(keyOf(reading), { revision: reading.revision, heights })
    },
  }
}
