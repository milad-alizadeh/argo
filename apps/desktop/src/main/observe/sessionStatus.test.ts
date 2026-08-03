import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { type Agent, SESSION_POSTURES, type SessionPosture } from '../../shared'
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

const DEFAULT_POSTURE: SessionPosture = 'external'

const signals = (over: {
  agents?: Agent[]
  posture?: SessionPosture
  processMatch?: boolean
  lastTimestampMs?: number | null
}) => ({
  posture: over.posture ?? DEFAULT_POSTURE,
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

  it('emits `asking` from a PENDING AskUserQuestion in the turn still running', () => {
    expect(deriveSessionStatus(signals({ agents: agentsOf('treeFull') }))).toEqual({
      value: 'asking',
      tier: 'derived',
    })
  })

  it('reads an ANSWERED question as idle rather than a false-active `asking`', () => {
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

  it('resolves down to idle when nothing corroborates the session running', () => {
    // Each row is one way the reading goes ambiguous; all three degrade to the same quiet state.
    const readings = [
      deriveSessionStatus(signals({ agents: agentsOf('stopUnknown'), processMatch: false })),
      deriveSessionStatus(
        signals({ agents: agentsOf('stopUnknown'), lastTimestampMs: NOW - 60 * 60 * 1000 }),
      ),
      deriveSessionStatus(signals({ agents: agentsOf('stopUnknown'), lastTimestampMs: null })),
    ]

    expect(readings.map((reading) => reading.value)).toEqual(['idle', 'idle', 'idle'])
  })

  it('leaves liveness untouched when there is no tree to refine it', () => {
    // An unparseable transcript costs the DERIVED refinements, not the dot: the process match
    // plus recency still reads running (cockpit-failure-states-spec.md §8).
    expect(deriveSessionStatus(signals({ agents: [] })).value).toBe('running')
  })

  it('still degrades an untreed session down when its process is gone', () => {
    expect(deriveSessionStatus(signals({ agents: [], processMatch: false })).value).toBe('idle')
  })

  it('grades every posture DERIVED — ownership is not a transcript key', () => {
    const agents = agentsOf('stopUnknown')

    expect(
      SESSION_POSTURES.map((posture) => deriveSessionStatus(signals({ agents, posture })).tier),
    ).toEqual(['derived', 'derived', 'derived'])
  })
})

describe('the states a posture can honestly reach', () => {
  it('reads a wall the agent hit as `stopped` for a session Argo owns', () => {
    const agents = agentsOf('haltedTurn')
    expect(deriveSessionStatus(signals({ agents, posture: 'managed' })).value).toBe('stopped')
  })

  it('collapses that same halt to idle the moment it is observed from outside', () => {
    const agents = agentsOf('haltedTurn')

    expect(deriveSessionStatus(signals({ agents, posture: 'external' })).value).toBe('idle')
    expect(
      deriveSessionStatus(signals({ agents, posture: 'orphaned', processMatch: false })).value,
    ).not.toBe('stopped')
  })

  it('reads `ended` only where Argo witnessed the process exit', () => {
    // `orphaned` IS that witness: Argo claimed the folder and saw its own PTY die.
    const agents = agentsOf('askAnswered')
    const orphaned = signals({ agents, posture: 'orphaned', processMatch: false })
    const external = signals({ agents, posture: 'external', processMatch: false })

    expect(deriveSessionStatus(orphaned).value).toBe('ended')
    expect(deriveSessionStatus(external).value).toBe('idle')
  })

  it('never reaches a state an external transcript cannot honestly carry', () => {
    const unreachable: string[] = ['permission', 'stopped', 'ended']
    const reached = [
      'treeFull',
      'askAnswered',
      'stopUnknown',
      'sidechain',
      'unparseableBody',
      'haltedTurn',
    ]
      .flatMap((fixture) => [true, false].map((processMatch) => ({ fixture, processMatch })))
      .map(
        ({ fixture, processMatch }) =>
          deriveSessionStatus(signals({ agents: agentsOf(fixture), processMatch })).value,
      )

    expect(reached.filter((state) => unreachable.includes(state))).toEqual([])
  })
})
