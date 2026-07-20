import { describe, expect, it } from 'vitest'
import { type AgentState, doneAgentCount, showsAgentStateWord } from './agentState'

describe('showsAgentStateWord', () => {
  it('always words a running or failed agent, whatever the rollup says', () => {
    expect(showsAgentStateWord('running', 'running')).toBe(true)
    expect(showsAgentStateWord('failed', 'failed')).toBe(true)
  })

  it('suppresses done and queued that only repeat the rollup', () => {
    expect(showsAgentStateWord('done', 'done')).toBe(false)
    expect(showsAgentStateWord('queued', 'queued')).toBe(false)
  })

  it('words done and queued that disagree with the rollup', () => {
    expect(showsAgentStateWord('done', 'running')).toBe(true)
    expect(showsAgentStateWord('queued', 'running')).toBe(true)
  })

  it('words every state on a lone row, which has no rollup to repeat', () => {
    const states: AgentState[] = ['running', 'done', 'failed', 'queued']
    for (const state of states) expect(showsAgentStateWord(state)).toBe(true)
  })
})

describe('doneAgentCount', () => {
  it('counts only done members', () => {
    expect(doneAgentCount([{ state: 'done' }, { state: 'running' }, { state: 'done' }])).toBe(2)
  })

  it('is zero for an empty roster', () => {
    expect(doneAgentCount([])).toBe(0)
  })

  it('does not count failed as done', () => {
    expect(doneAgentCount([{ state: 'failed' }, { state: 'queued' }])).toBe(0)
  })
})
