import type { Agent, Turn } from '@shared'
import { rootAgent, sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import { aRoot, planEntries as entries, aTurn as turn } from '../__fixtures__/runtimeTree'

import { sessionPlan } from './sessionPlan'

const rootWith = (turns: Turn[]): Agent => aRoot({ turns })

// The plan belongs to the SESSION and the agent replaces it wholesale (ADR-0020), so there is one of
// it however many turns reported a version.
describe('sessionPlan', () => {
  it('counts plan progress off the entries the agent authored', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([
          turn({ id: 't', plan: { entries: entries('completed', 'in_progress', 'pending') } }),
        ]),
      ],
    })
    expect(sessionPlan(session)).toEqual({
      done: 1,
      total: 3,
      entries: entries('completed', 'in_progress', 'pending'),
    })
  })

  // Reading the open turn alone blanked it: an agent that opens a turn without touching its plan
  // still has the plan it had.
  it('keeps the newest plan the session reported, across a turn that reported none', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([
          turn({ id: 'old', plan: { entries: entries('completed', 'pending') } }),
          turn({ id: 'open', stopReason: null }),
        ]),
      ],
    })
    expect(sessionPlan(session)).toMatchObject({ done: 1, total: 2 })
  })

  it('resolves ONE plan however many turns reported a version of it', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([
          turn({ id: 'a', plan: { entries: entries('pending', 'pending') } }),
          turn({ id: 'b', plan: { entries: entries('completed', 'pending') } }),
        ]),
      ],
    })
    expect(rootAgent(session.agents)?.turns).toHaveLength(2)
    expect(sessionPlan(session)).toMatchObject({ done: 1, total: 2 })
  })

  // A cleared list is not zero progress. Treating it as a snapshot would also let it MASK the last
  // real plan the session reported, which is the worse half of the bug.
  it('reads an emptied plan as absent rather than as `0 of 0`', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([
          turn({ id: 'had', plan: { entries: entries('completed', 'pending') } }),
          turn({ id: 'cleared', plan: { entries: [] } }),
        ]),
      ],
    })
    expect(sessionPlan(session)).toMatchObject({ done: 1, total: 2 })
  })

  it('claims no plan at all where every turn reported an empty one', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 't', plan: { entries: [] } })])],
    })
    expect(sessionPlan(session)).toBeNull()
  })
})
