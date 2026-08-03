import type { Agent, Turn } from '@shared'
import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import { aSubagent as agent, aRoot, aTurn as turn } from './__fixtures__/runtimeTree'
import { subagentGroup } from './interiorSubagents'

const NOW = 100 * 24 * 60 * 60_000

const rootWith = (turns: Turn[], compactions: Agent['compactions'] = []): Agent =>
  aRoot({ turns, compactions })

describe('subagentGroup', () => {
  it('draws no group at all for a session that spawned none', () => {
    expect(subagentGroup(sessionView({ id: 's', agents: [rootWith([])] }), NOW)).toBeNull()
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
    const group = subagentGroup(session, NOW)
    expect(group?.tier).toBe('phased')
    expect(group?.group).toBe('Verify')
  })

  it('degrades to a labelled tree where names arrived without a group', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([]), agent({ id: 'a', label: 'correctness lens' })],
    })
    const group = subagentGroup(session, NOW)
    expect(group?.tier).toBe('labelled')
    expect(group?.group).toBeNull()
  })

  it('degrades to flat where the CLI reported neither, and never invents a phase', () => {
    const session = sessionView({ id: 's', agents: [rootWith([]), agent({ id: 'a' })] })
    const group = subagentGroup(session, NOW)
    expect(group?.tier).toBe('flat')
    expect(group?.rows[0]?.name).toBe('a')
  })
})

// The case the blueprint exists for: a Workflow whose subagents sit in two phases. Naming the first
// over rows that mostly belong to the other is the invented fact the tier gating refuses.
describe('the phase a group claims', () => {
  it('names no phase when the subagents sit in more than one', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([]),
        agent({ id: 'a', label: 'find', group: 'Find' }),
        agent({ id: 'b', label: 'verify one', group: 'Verify' }),
        agent({ id: 'c', label: 'verify two', group: 'Verify' }),
      ],
    })
    const group = subagentGroup(session, NOW)
    expect(group?.tier).toBe('phased')
    expect(group?.group).toBeNull()
    expect(group?.summary).toBe('3 · 0 running')
  })

  it('names no phase when only some of them reported one', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([]), agent({ id: 'a', group: 'Find' }), agent({ id: 'b' })],
    })
    expect(subagentGroup(session, NOW)?.group).toBeNull()
  })

  it('spells the summary once, phase-first where they share one', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([]),
        agent({ id: 'a', group: 'Verify', turns: [turn({ id: 't', stopReason: null })] }),
        agent({ id: 'b', group: 'Verify' }),
      ],
    })
    expect(subagentGroup(session, NOW)?.summary).toBe('Verify · 1 running')
  })
})
