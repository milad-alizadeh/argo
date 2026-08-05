import type { FeedRow, MediaRowModel } from '@shared'

// A chapter's rows split for rendering: every run of consecutive screenshots pulled out as one
// gallery segment, so four shots cost one row of thumbs rather than four screens of pixels.

export type Segment =
  | { key: string; kind: 'rows'; rows: FeedRow[] }
  | { key: string; kind: 'shots'; shots: MediaRowModel[] }

export function segmentsOf(rows: readonly FeedRow[]): Segment[] {
  const segments: Segment[] = []
  // The prompt row is dropped: the sticky seam already leads with the prompt, and the same
  // sentence twice within an inch is repetition. The cost is honest — a multi-line prompt loses
  // its tail to the seam's truncation, and keeps its record in the transcript view.
  for (const row of rows.filter((candidate) => candidate.kind !== 'prompt')) {
    const last = segments.at(-1)
    if (row.kind === 'media') {
      if (last?.kind === 'shots') last.shots.push(row)
      else segments.push({ key: row.key, kind: 'shots', shots: [row] })
    } else if (last?.kind === 'rows') {
      last.rows.push(row)
    } else {
      segments.push({ key: row.key, kind: 'rows', rows: [row] })
    }
  }
  return segments
}
