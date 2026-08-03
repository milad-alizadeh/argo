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

  // The same `name target` the live task reads: what it last did is worth as much of the row as what
  // it is doing, and a bare verb names nothing.
  it('names what it last did, target and all, once nothing is in flight', () => {
    const session = sessionView({
      id: 's',
      agents: [
        root([
          turn({ id: 't', toolCalls: [call({ id: 'c', name: 'Edit', target: 'rotation.ts' })] }),
        ]),
      ],
    })
    expect(nowHead(session)).toMatchObject({ task: null, last: 'Edit rotation.ts', live: false })
  })

  // A pending call is one the agent has not started, so naming it as the last thing done would
  // report work that never happened.
  it('skips a queued call when naming the last thing done', () => {
    const session = sessionView({
      id: 's',
      agents: [
        root([
          turn({
            id: 't',
            toolCalls: [
              call({ id: 'ran', name: 'Bash', status: 'completed' }),
              call({ id: 'queued', name: 'Edit', status: 'pending' }),
            ],
          }),
        ]),
      ],
    })
    expect(nowHead(session).last).toBe('Bash')
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
