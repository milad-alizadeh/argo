import { describe, expect, it } from 'vitest'
import { rootAgent } from '../../shared'
import { file, logicalOf, running, turn } from './__fixtures__/logical'
import { toObservedSession } from './observedSession'

// The runtime tree the observer assembles out of a chain: who the root is, whose turns are on it,
// and what each node can honestly say about its own span and spend.

describe('the Session as the root Agent', () => {
  it('keys the root by parentId with no kind discriminant', () => {
    const observed = toObservedSession(logicalOf(file({})), 'external', running)
    const root = rootAgent(observed.agents)

    expect(root).toEqual({
      id: 'file-1',
      parentId: null,
      turns: [],
      compactions: [],
      // A chain with no turns has no span to report, and the root's spend lives on its turns.
      startedAtMs: null,
      endedAtMs: null,
      usage: null,
    })
    expect(Object.keys(root ?? {})).not.toContain('kind')
  })

  it('concatenates the chain’s turns onto one root Agent, in root → leaf order', () => {
    const root = file({
      sessionId: 'chain-root',
      tree: { turns: [turn('t1')], compactions: [], subagents: [] },
    })
    const leaf = file({
      sessionId: 'chain-leaf',
      tree: { turns: [turn('t2')], compactions: [{ beforeTurnId: 't2' }], subagents: [] },
    })
    const observed = toObservedSession(logicalOf(root, leaf), 'external', running)

    expect(rootAgent(observed.agents)?.turns.map((entry) => entry.id)).toEqual(['t1', 't2'])
    expect(rootAgent(observed.agents)?.compactions).toEqual([{ beforeTurnId: 't2' }])
  })

  // The session's whole working span, and the reason a running one has no end: its last turn has
  // not closed, so the duration is measured against the wall clock rather than a fabricated end.
  it('spans the root from its first turn’s start to its last turn’s end', () => {
    const open = file({
      tree: {
        turns: [turn('t1', { startedAtMs: 100, endedAtMs: 400 }), turn('t2', { startedAtMs: 700 })],
        compactions: [],
        subagents: [],
      },
    })
    const root = rootAgent(toObservedSession(logicalOf(open), 'external', running).agents)

    expect(root?.startedAtMs).toBe(100)
    expect(root?.endedAtMs).toBeNull()
  })
})

describe('the Subagents parented to it', () => {
  it('parents every Subagent to the root and keeps an unreported label absent', () => {
    const leaf = file({
      tree: {
        turns: [],
        compactions: [],
        subagents: [
          { id: 'sub-1', label: 'research: chains', startedAtMs: 10, endedAtMs: 40, usage: null },
          { id: 'sub-2', startedAtMs: null, endedAtMs: null, usage: null },
        ],
      },
    })
    const observed = toObservedSession(logicalOf(leaf), 'external', running)

    expect(observed.agents.filter((agent) => agent.parentId === 'file-1')).toEqual([
      {
        id: 'sub-1',
        label: 'research: chains',
        parentId: 'file-1',
        turns: [],
        compactions: [],
        startedAtMs: 10,
        endedAtMs: 40,
        usage: null,
      },
      {
        id: 'sub-2',
        parentId: 'file-1',
        turns: [],
        compactions: [],
        startedAtMs: null,
        endedAtMs: null,
        usage: null,
      },
    ])
  })

  // A delegate's interior lives in its OWN transcript, joined to the seed by the id of the call
  // that spawned it. Without the join the rail row opens onto nothing.
  it("carries a delegate's own turns, joined by the call that spawned it", () => {
    const leaf = file({
      tree: {
        turns: [],
        compactions: [],
        subagents: [{ id: 'toolu_1', startedAtMs: null, endedAtMs: null, usage: null }],
      },
      delegateTurns: { toolu_1: [turn('d1')] },
    })
    const observed = toObservedSession(logicalOf(leaf), 'external', running)

    expect(observed.agents.at(-1)?.turns.map((entry) => entry.id)).toEqual(['d1'])
  })
})
