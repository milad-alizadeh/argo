import { describe, expect, it } from 'vitest'
import { aDiff, anAgent, anEdit, aTurn, said } from './__fixtures__/tree'
import { feedRows } from './feedRows'
import type { ToolCall } from './runtimeTree'

// The MUTATION rows of the feed, split from `feedRows.test.ts` for the line ceiling: that file
// judges the prose rows and their order, this one judges what a change to a file reads as.

// Mutation rows, table-driven: the reading rules for a change the agent made, judged without
// mounting anything.
const MUTATIONS: readonly [string, ToolCall, Record<string, unknown>][] = [
  [
    'a completed edit carries its diff, its path and its churn',
    anEdit({ id: 'c1' }),
    { kind: 'mutation', key: 'mutation:c1', path: 'src/token.ts', status: 'completed' },
  ],
  [
    'a creation and a deletion are their own change, never flattened to an edit',
    anEdit({ id: 'c2', result: aDiff({ change: 'delete', added: 0, removed: 12 }) }),
    { kind: 'mutation', status: 'completed', diff: { change: 'delete', removed: 12 } },
  ],
  // The result may still be coming, and it may never come. Either way the row is not finished.
  [
    'a mutation whose result never arrived is pending and carries no diff',
    anEdit({ id: 'c3', status: 'pending', result: null }),
    { kind: 'mutation', status: 'pending', diff: null },
  ],
  [
    'a failed mutation keeps its failure and shows no diff',
    anEdit({ id: 'c4', status: 'failed', result: null }),
    { kind: 'mutation', status: 'failed', diff: null },
  ],
  // A binary or unreadable patch: the change happened, and the row says it has nothing to show
  // rather than disappearing.
  [
    'an unreadable patch is a mutation with no hunks, not a missing row',
    anEdit({ id: 'c5', result: aDiff({ hunks: [], added: 0, removed: 0 }) }),
    { kind: 'mutation', status: 'completed', diff: { hunks: [], added: 0, removed: 0 } },
  ],
  [
    'a call the record named no file for keeps an absent path rather than a made-up one',
    anEdit({ id: 'c6', target: null }),
    { kind: 'mutation', path: null },
  ],
  // A pending call whose record somehow carried a patch would be a finished row wearing a
  // running state.
  [
    'a pending mutation shows no diff even where one was read',
    anEdit({ id: 'c7', status: 'pending' }),
    { kind: 'mutation', status: 'pending', diff: null },
  ],
]

describe('a mutation row', () => {
  it.each(MUTATIONS)('%s', (_name, call, expected) => {
    const [row] = feedRows(anAgent([aTurn({ id: 't1', toolCalls: [call] })]))

    expect(row).toMatchObject(expected)
  })

  // Where a change sits in the narrative is the whole point of putting it there: appending every
  // mutation after the prose would put each change below the paragraph explaining it.
  it('places each mutation at the point in the prose the call was made', () => {
    const rows = feedRows(
      anAgent([
        aTurn({
          id: 't1',
          prose: [said('first'), said('second')],
          toolCalls: [
            anEdit({ id: 'late', proseIndex: 2 }),
            anEdit({ id: 'early', proseIndex: 1 }),
          ],
        }),
      ]),
    )

    expect(rows.map((row) => row.key)).toEqual([
      'prose:t1:0',
      'mutation:early',
      'prose:t1:1',
      'mutation:late',
    ])
  })

  // Folding, commands and media are the next tickets'. A read rendered at a mutation's weight is
  // the wall of undifferentiated chatter this whole surface exists to correct.
  it('renders no row for a call that changed nothing', () => {
    const rows = feedRows(
      anAgent([
        aTurn({
          id: 't1',
          prose: [said('looked')],
          toolCalls: [anEdit({ id: 'r', name: 'Read', kind: 'read', result: null })],
        }),
      ]),
    )

    expect(rows.map(({ kind }) => kind)).toEqual(['message'])
  })
})
