import { type LifecycleModel, sessionFacts } from '@shared'
import { describe, expect, it } from 'vitest'
import { deliveryState } from './deliveryState'
import type { RosterWord } from './rosterStatus'
import { STATE_MATRIX_ROWS, stateMatrixInput } from './stateMatrix'

// The state table of `docs/designs/cockpit-surface-matrix.md`, one row per case: given the facts,
// the lifecycle, its head, and the rail's one word are fully determined. The inputs live in
// `stateMatrix.ts` so the SessionScreen stories replay the same rows; this test owns the expected
// outputs. The dot each word carries is `rosterStatus.test.ts`'s subject, not this sweep's.

const outcomes: readonly { id: string; model: LifecycleModel | null; word: RosterWord }[] = [
  { id: 'S0', model: null, word: 'running' },
  {
    id: 'S1',
    model: {
      nodes: { commits: 'now', pr: 'wait', ci: 'wait', review: 'wait', merge: 'wait' },
      head: 'commits',
      terminal: null,
    },
    word: 'running',
  },
  {
    id: 'S2',
    model: {
      nodes: { commits: 'gate', pr: 'wait', ci: 'wait', review: 'wait', merge: 'wait' },
      head: 'commits',
      terminal: null,
    },
    word: 'idle',
  },
  {
    id: 'S3',
    model: {
      nodes: { commits: 'done', pr: 'gate', ci: 'wait', review: 'wait', merge: 'wait' },
      head: 'pr',
      terminal: null,
    },
    word: 'idle',
  },
  {
    id: 'S3b',
    model: {
      nodes: { commits: 'done', pr: 'auto', ci: 'wait', review: 'wait', merge: 'wait' },
      head: 'pr',
      terminal: null,
    },
    word: 'running',
  },
  {
    id: 'S4',
    model: {
      nodes: { commits: 'done', pr: 'done', ci: 'now', review: 'wait', merge: 'wait' },
      head: 'ci',
      terminal: null,
    },
    word: 'CI running',
  },
  {
    id: 'S5',
    model: {
      nodes: { commits: 'done', pr: 'done', ci: 'fail', review: 'wait', merge: 'wait' },
      head: 'ci',
      terminal: null,
    },
    word: 'CI failed',
  },
  {
    id: 'S6',
    model: {
      nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'now', merge: 'wait' },
      head: 'review',
      terminal: null,
    },
    word: 'PR open',
  },
  {
    id: 'S7',
    model: {
      nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'warn', merge: 'wait' },
      head: 'review',
      terminal: null,
    },
    word: 'PR open',
  },
  {
    id: 'S8',
    model: {
      nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'done', merge: 'gate' },
      head: 'merge',
      terminal: null,
    },
    word: 'PR open',
  },
  {
    id: 'S8b',
    model: {
      nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'done', merge: 'auto' },
      head: 'merge',
      terminal: null,
    },
    word: 'PR open',
  },
  {
    id: 'S9',
    model: {
      nodes: { commits: 'sync', pr: 'done', ci: 'stale', review: 'stale', merge: 'lock' },
      head: 'commits',
      terminal: null,
    },
    word: 'running',
  },
  { id: 'S10', model: { nodes: null, head: null, terminal: 'merged' }, word: 'merged' },
  { id: 'S11', model: { nodes: null, head: null, terminal: 'closed' }, word: 'running' },
]

const labelOf = (id: string) => STATE_MATRIX_ROWS.find((row) => row.id === id)?.label

describe('the delivery matrix', () => {
  it('states an outcome for every row of the matrix', () => {
    expect(outcomes.map(({ id }) => id)).toEqual(STATE_MATRIX_ROWS.map((row) => row.id))
  })

  for (const { id, model } of outcomes) {
    it(`grows the lifecycle the matrix records for ${id} — ${labelOf(id)}`, () => {
      expect(deliveryState(sessionFacts(stateMatrixInput(id))).lifecycle).toEqual(model)
    })
  }

  for (const { id, word } of outcomes) {
    it(`reads "${word}" on ${id} — ${labelOf(id)}`, () => {
      expect(deliveryState(sessionFacts(stateMatrixInput(id))).rail.word).toBe(word)
    })
  }
})
