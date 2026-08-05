import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import {
  aSubagent as agent,
  aRoot,
  aToolCall as call,
  aTurn as turn,
} from './__fixtures__/runtimeTree'
import { subagentGroup, subagentsOf } from './interiorSubagents'

// What ONE row in the fanout says about its delegate. Its cost and duration both come from the
// parent's record of the call that spawned it — a subagent's own turns run in a sidechain the
// parent transcript does not attribute, so this is the only place either is ever visible.

/** The root's id in the fixtures — whose delegates the group is now built from. */
const ROOT = 'root'

const NOW = 100 * 24 * 60 * 60_000

const rootWith = () => aRoot({ turns: [] })

describe('what a row says it is', () => {
  it('grades each row off its own turns and counts the running ones', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith(),
        agent({
          id: 'running',
          label: 'correctness lens',
          turns: [
            turn({
              id: 't',
              stopReason: null,
              toolCalls: [call({ id: 'c', target: 'rotation.ts' })],
            }),
          ],
        }),
        agent({ id: 'queued', label: 'repro lens' }),
        agent({ id: 'done', label: 'security lens', turns: [turn({ id: 'u' })] }),
      ],
    })
    const group = subagentGroup(subagentsOf(session, ROOT), NOW)
    expect(group?.rows.map((row) => row.status)).toEqual(['running', 'queued', 'done'])
    expect(group?.rows[0]?.target).toBe('rotation.ts')
    // `null`, not an empty string: one encoding of absence, the same one a tool step's target uses.
    expect(group?.rows[1]?.target).toBeNull()
    expect(group?.rows[0]?.dot).toEqual({ tone: 'run', glow: 'live', pulse: true })
    expect(group?.runningCount).toBe(1)
  })
})

describe('what a row says it cost', () => {
  it('times a running row against the clock and claims no spend until its result lands', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith(),
        agent({
          id: 'running',
          startedAtMs: NOW - 12 * 60_000,
          turns: [turn({ id: 't', stopReason: null })],
        }),
      ],
    })
    const row = subagentGroup(subagentsOf(session, ROOT), NOW)?.rows[0]
    expect(row?.took).toBe('12 minutes')
    expect(row?.tokens).toBeNull()
  })

  it('reports a finished row’s own span and the spend its result carried', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith(),
        agent({
          id: 'done',
          startedAtMs: NOW - 20 * 60_000,
          endedAtMs: NOW - 16 * 60_000,
          usage: {
            inputTokens: 2,
            outputTokens: 3_610,
            cacheReadTokens: 82_107,
            cacheCreationTokens: 549,
          },
          turns: [turn({ id: 't' })],
        }),
      ],
    })
    const row = subagentGroup(subagentsOf(session, ROOT), NOW)?.rows[0]
    expect(row?.took).toBe('4 minutes')
    expect(row?.tokens).toBe('86.3K')
  })

  it('claims neither where the record timed and costed nothing', () => {
    const session = sessionView({ id: 's', agents: [rootWith(), agent({ id: 'a' })] })
    const row = subagentGroup(subagentsOf(session, ROOT), NOW)?.rows[0]
    expect(row?.took).toBeNull()
    expect(row?.tokens).toBeNull()
  })

  it('scales to a wide fanout without folding rows away', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      agent({ id: `a${index}`, label: `lens ${index}`, group: 'Verify' }),
    )
    expect(
      subagentGroup(subagentsOf(sessionView({ id: 's', agents: [rootWith(), ...many] }), ROOT), NOW)
        ?.rows,
    ).toHaveLength(30)
  })
})
