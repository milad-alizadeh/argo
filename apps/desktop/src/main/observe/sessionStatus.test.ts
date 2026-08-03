import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { type Agent, SESSION_STATES, type SessionPosture } from '../../shared'
import { parseTranscript } from './claudeTranscript'
import { deriveSessionStatus } from './sessionStatus'

const NOW = Date.parse('2026-07-20T20:00:00.000Z')

/** The root Agent a fixture folds into — the shape the observer hands the derivation. */
function agentsOf(fixture: string): Agent[] {
  const { tree } = parseTranscript(
    fixture,
    readFileSync(join(__dirname, '__fixtures__', `${fixture}.jsonl`), 'utf8').split('\n'),
  )
  return [{ id: fixture, parentId: null, turns: tree.turns, compactions: tree.compactions }]
}

const signals = (over: {
  agents?: Agent[]
  posture?: SessionPosture
  processMatch?: boolean
  lastTimestampMs?: number | null
}) => ({
  posture: over.posture ?? ('external' as SessionPosture),
  processMatch: over.processMatch ?? true,
  lastTimestampMs: over.lastTimestampMs === undefined ? NOW : over.lastTimestampMs,
  nowMs: NOW,
  agents: over.agents ?? [],
})

describe('deriveSessionStatus', () => {
  it('reads a matching process with a turn still open as running', () => {
    const status = deriveSessionStatus(signals({ agents: agentsOf('stopUnknown') }))
    expect(status).toEqual({ value: 'running', tier: 'derived' })
  })

  it('reads a live process whose last turn ENDED as idle — alive, not working', () => {
    const status = deriveSessionStatus(signals({ agents: agentsOf('askAnswered') }))
    expect(status).toEqual({ value: 'idle', tier: 'derived' })
  })

  it('emits `asking` from a PENDING AskUserQuestion, and never from an answered one', () => {
    // treeFull's open turn holds an unanswered question; askAnswered's was answered and its
    // turn is over. A resolved question reading as `asking` would be a false-active.
    expect(deriveSessionStatus(signals({ agents: agentsOf('treeFull') }))).toEqual({
      value: 'asking',
      tier: 'derived',
    })
    expect(deriveSessionStatus(signals({ agents: agentsOf('askAnswered') })).value).not.toBe(
      'asking',
    )
  })

  it('never emits `asking` for a session with no live process behind it', () => {
    const status = deriveSessionStatus(
      signals({ agents: agentsOf('treeFull'), processMatch: false }),
    )
    expect(status.value).toBe('idle')
  })

  it('resolves down to idle with no process match, or a transcript gone stale', () => {
    const dead = deriveSessionStatus(
      signals({ agents: agentsOf('stopUnknown'), processMatch: false }),
    )
    const stale = deriveSessionStatus(
      signals({ agents: agentsOf('stopUnknown'), lastTimestampMs: NOW - 60 * 60 * 1000 }),
    )
    const noRecency = deriveSessionStatus(
      signals({ agents: agentsOf('stopUnknown'), lastTimestampMs: null }),
    )

    expect([dead.value, stale.value, noRecency.value]).toEqual(['idle', 'idle', 'idle'])
  })

  it('leaves liveness untouched when there is no tree to refine it', () => {
    // An unparseable transcript costs the DERIVED refinements, not the dot: the process match
    // plus recency still reads running (cockpit-failure-states-spec.md §8).
    expect(deriveSessionStatus(signals({ agents: [] })).value).toBe('running')
    expect(deriveSessionStatus(signals({ agents: [], processMatch: false })).value).toBe('idle')
  })

  it('never reaches a state an external transcript cannot honestly carry', () => {
    const unreachable: string[] = SESSION_STATES.filter(
      (state) => state === 'permission' || state === 'stopped' || state === 'ended',
    )
    const reached = ['treeFull', 'askAnswered', 'stopUnknown', 'sidechain', 'unparseableBody']
      .flatMap((fixture) => [true, false].map((processMatch) => ({ fixture, processMatch })))
      .map(
        ({ fixture, processMatch }) =>
          deriveSessionStatus(signals({ agents: agentsOf(fixture), processMatch })).value,
      )

    expect(reached.filter((state) => unreachable.includes(state))).toEqual([])
  })

  it('grades a managed Session DIRECT and an orphaned one back down to DERIVED', () => {
    const agents = agentsOf('stopUnknown')
    expect(deriveSessionStatus(signals({ agents, posture: 'managed' })).tier).toBe('direct')
    expect(deriveSessionStatus(signals({ agents, posture: 'orphaned' })).tier).toBe('derived')
  })
})
