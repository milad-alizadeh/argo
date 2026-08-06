import { describe, expect, it } from 'vitest'
import { aCall, anAgent, anEdit, aTurn, said } from '../__fixtures__/tree'
import type { ToolCall } from '../session/runtimeTree'
import { feedRows } from './rows'

// The QUIET half of the feed: observation folded to one counted row, and the loud rows that break the
// run. Split from `feedRows.test.ts` for the line ceiling — that file judges prose and its order.
//
// One rule is under test throughout: mutations and failures are loud, observation is quiet. What
// makes it hold is the BREAK, which is why every loud kind gets its own row here.

const kindsOf = (turn: Parameters<typeof aTurn>[0]) =>
  feedRows(anAgent([aTurn(turn)])).map((row) => row.kind)

const reads = (count: number, from = 0): ToolCall[] =>
  Array.from({ length: count }, (_, index) => aCall({ id: `r${from + index}` }))

describe('a folded run of quiet work', () => {
  it('folds consecutive reads and searches into one row counted per kind', () => {
    const rows = feedRows(
      anAgent([
        aTurn({
          id: 't1',
          toolCalls: [...reads(3), aCall({ id: 's1', name: 'Grep', kind: 'search' })],
        }),
      ]),
    )

    expect(rows).toMatchObject([
      {
        kind: 'quiet',
        key: 'quiet:r0',
        counts: [
          { word: 'read', count: 3 },
          { word: 'searched', count: 1 },
        ],
      },
    ])
    expect(rows).toHaveLength(1)
  })

  // Folding is not discarding. The counts are the row; the calls are what it opens onto, and
  // without them "read 3" is a claim with no way to check it anywhere in the app.
  it('keeps the calls it folded, in the order they happened', () => {
    const rows = feedRows(
      anAgent([
        aTurn({
          id: 't1',
          toolCalls: [...reads(2), aCall({ id: 's1', name: 'Grep', kind: 'search' })],
        }),
      ]),
    )

    expect(rows[0]).toMatchObject({
      calls: [
        { key: 'quiet-call:r0', word: 'read' },
        { key: 'quiet-call:r1', word: 'read' },
        { key: 'quiet-call:s1', word: 'searched' },
      ],
    })
  })

  // A count is not a sentence: "read a file, read a file, read a file" is what a host-style summary
  // degrades into at thirty calls, which is the whole reason the label is arithmetic.
  it('counts a run of thirty as one row rather than thirty labels', () => {
    const rows = feedRows(anAgent([aTurn({ id: 't1', toolCalls: reads(30) })]))

    expect(rows).toMatchObject([
      { kind: 'quiet', key: 'quiet:r0', counts: [{ word: 'read', count: 30 }] },
    ])
  })

  it('folds a single quiet call to a quiet row rather than giving it a row of its own', () => {
    expect(kindsOf({ id: 't1', toolCalls: reads(1) })).toEqual(['quiet'])
  })

  it('names a fetch in the fold with its own word, never as a read', () => {
    const rows = feedRows(
      anAgent([
        aTurn({ id: 't1', toolCalls: [aCall({ id: 'f', name: 'WebFetch', kind: 'fetch' })] }),
      ]),
    )

    expect(rows).toMatchObject([
      { kind: 'quiet', key: 'quiet:f', counts: [{ word: 'fetched', count: 1 }] },
    ])
  })
})

// Every loud kind, one row each: the break is what makes "edited a file, FAILED at something, read
// a file" structurally impossible rather than merely discouraged — a fold can never span a row that
// stands on its own.
const BREAKS: readonly [string, ToolCall, string][] = [
  ['a mutation', anEdit({ id: 'loud' }), 'mutation'],
  ['a failed call', aCall({ id: 'loud', status: 'failed' }), 'call'],
  // NOT a command. Commands fold now, which is the point — a run of them is a block you scan or
  // skip, and a successful one no longer interrupts the reads around it. A FAILED command still
  // breaks the run, and that is the case above.
]

describe('what breaks a fold', () => {
  it.each(BREAKS)(
    'a run breaks at %s, so loud and quiet never share one label',
    (_name, loud, loudRow) => {
      const kinds = kindsOf({ id: 't1', toolCalls: [...reads(2), loud, ...reads(2, 2)] })

      expect(kinds).toEqual(['quiet', loudRow, 'quiet'])
    },
  )

  // The reads ARE the evidence for the paragraph beneath them, which is the reading the feed exists
  // to give — so the prose row breaks the run and the run sits welded to the prose that follows.
  it('breaks a run at a prose row, leaving the reads directly above the message', () => {
    const rows = feedRows(
      anAgent([
        aTurn({
          id: 't1',
          prose: [said('looked'), said('concluded')],
          toolCalls: [...reads(2), ...reads(2, 2).map((call) => ({ ...call, proseIndex: 1 }))],
        }),
      ]),
    )

    expect(rows.map((row) => row.key)).toEqual(['quiet:r0', 'prose:t1:0', 'quiet:r2', 'prose:t1:1'])
  })

  // A delegate has no row at all, so there is no row for a run to break at: the reads either side of
  // it are still consecutive observation, and splitting them would report a break nothing shows.
  it('keeps a run whole across a delegate, which contributes no row to break at', () => {
    const kinds = kindsOf({
      id: 't1',
      toolCalls: [...reads(2), aCall({ id: 'd', name: 'Task', kind: 'delegate' }), ...reads(2, 2)],
    })

    expect(kinds).toEqual(['quiet'])
  })
})
