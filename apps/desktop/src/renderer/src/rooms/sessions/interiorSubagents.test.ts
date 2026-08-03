import type { Agent, Turn } from '@shared'
import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import {
  aSubagent as agent,
  aRoot,
  aToolCall as call,
  aTurn as turn,
} from './__fixtures__/runtimeTree'
import { subagentGroup } from './interiorSubagents'

const rootWith = (turns: Turn[], compactions: Agent['compactions'] = []): Agent =>
  aRoot({ turns, compactions })

describe('subagentGroup', () => {
  it('draws no group at all for a session that spawned none', () => {
    expect(subagentGroup(sessionView({ id: 's', agents: [rootWith([])] }))).toBeNull()
  })

  it('reads a phased blueprint only where the CLI reported a group', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([]),
        agent({ id: 'a', label: 'correctness lens', group: 'Verify' }),
        agent({ id: 'b', label: 'security lens', group: 'Verify' }),
      ],
    })
    const group = subagentGroup(session)
    expect(group?.tier).toBe('phased')
    expect(group?.group).toBe('Verify')
  })

  it('degrades to a labelled tree where names arrived without a group', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([]), agent({ id: 'a', label: 'correctness lens' })],
    })
    const group = subagentGroup(session)
    expect(group?.tier).toBe('labelled')
    expect(group?.group).toBeNull()
  })

  it('degrades to flat where the CLI reported neither, and never invents a phase', () => {
    const session = sessionView({ id: 's', agents: [rootWith([]), agent({ id: 'a' })] })
    const group = subagentGroup(session)
    expect(group?.tier).toBe('flat')
    expect(group?.rows[0]?.name).toBe('a')
  })
})

describe('the subagent rows', () => {
  it('grades each row off its own turns and counts the running ones', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([]),
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
    const group = subagentGroup(session)
    expect(group?.rows.map((row) => row.status)).toEqual(['running', 'queued', 'done'])
    expect(group?.rows[0]?.target).toBe('rotation.ts')
    expect(group?.rows[0]?.dot).toEqual({ tone: 'run', glow: 'live', pulse: true })
    expect(group?.runningCount).toBe(1)
  })

  it('scales to a wide fanout without folding rows away', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      agent({ id: `a${index}`, label: `lens ${index}`, group: 'Verify' }),
    )
    expect(
      subagentGroup(sessionView({ id: 's', agents: [rootWith([]), ...many] }))?.rows,
    ).toHaveLength(30)
  })
})
