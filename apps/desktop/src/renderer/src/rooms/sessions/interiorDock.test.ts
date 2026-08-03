import type { Agent, Turn } from '@shared'
import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import { aRoot, aToolCall as call, aTurn as turn } from './__fixtures__/runtimeTree'
import { buildDock, nowHead } from './interiorDock'

const root = (turns: Turn[]): Agent => aRoot({ turns })

describe('nowHead', () => {
  it('names the call in flight and the plan beside it', () => {
    const session = sessionView({
      id: 's',
      agents: [
        root([
          turn({
            id: 'open',
            stopReason: null,
            toolCalls: [
              call({ id: 'c', name: 'Edit', status: 'in_progress', target: 'rotation.ts' }),
            ],
            plan: {
              entries: [
                { text: 'one', status: 'completed' },
                { text: 'two', status: 'in_progress' },
              ],
            },
          }),
        ]),
      ],
    })
    expect(nowHead(session)).toEqual({
      task: 'Edit rotation.ts',
      plan: { done: 1, total: 2 },
      last: null,
      live: true,
    })
  })

  it('names what it last did once nothing is in flight', () => {
    const session = sessionView({
      id: 's',
      agents: [root([turn({ id: 't', toolCalls: [call({ id: 'c', name: 'Bash' })] })])],
    })
    expect(nowHead(session)).toMatchObject({ task: null, last: 'Bash', live: false })
  })

  it('claims nothing for a session with no readable tree', () => {
    expect(nowHead(sessionView({ id: 's' }))).toEqual({
      task: null,
      plan: null,
      last: null,
      live: false,
    })
  })
})

describe('buildDock', () => {
  it('offers a PTY for a session Argo drives', () => {
    expect(buildDock(sessionView({ id: 's' })).kind).toBe('pty')
  })

  it('degrades to a transcript replay where there is no PTY to steer', () => {
    expect(buildDock(sessionView({ id: 's', posture: 'external' })).kind).toBe('transcript')
    expect(buildDock(sessionView({ id: 's', posture: 'orphaned' })).kind).toBe('transcript')
  })
})
