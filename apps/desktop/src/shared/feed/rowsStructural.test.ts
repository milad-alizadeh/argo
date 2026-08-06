import { describe, expect, it } from 'vitest'
import { aCall, anAgent, anEdit, aTurn, aUsage, said } from '../__fixtures__/tree'
import type { Plan } from '../session/runtimeTree'
import { feedRows } from './rows'

// The two STRUCTURAL rows — the plan and the compaction seam — and the two things that deliberately
// contribute no row at all.

const A_PLAN: Plan = {
  entries: [
    { text: 'Read the legacy module', status: 'completed' },
    { text: 'Extract the rotation', status: 'in_progress' },
  ],
}

const planCall = (proseIndex = 0) =>
  aCall({ id: 'todo', name: 'TodoWrite', kind: 'plan', target: null, proseIndex })

describe('the plan row', () => {
  it('reflects the latest entries and their statuses', () => {
    const rows = feedRows(anAgent([aTurn({ id: 't1', plan: A_PLAN, toolCalls: [planCall()] })]))

    expect(rows).toEqual([{ kind: 'plan', key: 'plan:t1', plan: A_PLAN }])
  })

  // A Turn carries the snapshot in force while it ran, so ten ticks inside one exchange are ONE row
  // updated in place. A row per revision would flood the feed with the same list ten times.
  it('stays one row however many times the turn revised it', () => {
    const rows = feedRows(
      anAgent([aTurn({ id: 't1', plan: A_PLAN, toolCalls: [planCall(), planCall(), planCall()] })]),
    )

    expect(rows.filter((row) => row.kind === 'plan')).toHaveLength(1)
  })

  it('sits at the point in the narrative the plan was last revised', () => {
    const rows = feedRows(
      anAgent([
        aTurn({
          id: 't1',
          prose: [said('starting'), said('done')],
          plan: A_PLAN,
          toolCalls: [planCall(1)],
        }),
      ]),
    )

    expect(rows.map((row) => row.kind)).toEqual(['message', 'plan', 'message'])
  })

  it('is absent from a turn that touched no plan', () => {
    const rows = feedRows(anAgent([aTurn({ id: 't1', prose: [said('a')] })]))

    expect(rows.map((row) => row.kind)).toEqual(['message'])
  })

  // An emptied list is not zero progress: reading it as a snapshot would let a cleared plan stand in
  // for the last real one the session reported.
  it('reads an emptied list as no plan at all', () => {
    const rows = feedRows(anAgent([aTurn({ id: 't1', plan: { entries: [] } })]))

    expect(rows).toEqual([])
  })
})

describe('the compaction seam', () => {
  it('renders as its own row in front of the turn it precedes', () => {
    const rows = feedRows(
      anAgent(
        [
          aTurn({ id: 'before', prompt: 'one' }),
          aTurn({ id: 'after', prompt: 'two', prose: [said('carried on')] }),
        ],
        [{ beforeTurnId: 'after' }],
      ),
    )

    expect(rows.map((row) => row.key)).toEqual([
      'prompt:before',
      'compaction:after',
      'prompt:after',
      'prose:after:0',
    ])
  })

  it('is absent from a chain nothing was compacted in', () => {
    const rows = feedRows(anAgent([aTurn({ id: 't1', prompt: 'one' })]))

    expect(rows.map((row) => row.kind)).toEqual(['prompt'])
  })
})

describe('what contributes no row', () => {
  // The Subagents section owns a delegate: a work row here would report a turn's largest event
  // twice, in the one place the work itself is not.
  it('gives a delegate no row of its own', () => {
    const rows = feedRows(
      anAgent([
        aTurn({
          id: 't1',
          prose: [said('delegated')],
          toolCalls: [aCall({ id: 'd', name: 'Task', kind: 'delegate', target: 'research' })],
        }),
      ]),
    )

    expect(rows.map((row) => row.kind)).toEqual(['message'])
  })

  // Usage is a rollup the header's context ring already shows. A row of it would put a number the
  // whole session shares inside one exchange.
  it('gives usage no row, on the turn or on the agent', () => {
    const rows = feedRows(
      anAgent([aTurn({ id: 't1', usage: aUsage(), toolCalls: [anEdit({ id: 'e' })] })]),
    )

    expect(rows.map((row) => row.kind)).toEqual(['mutation'])
  })
})
