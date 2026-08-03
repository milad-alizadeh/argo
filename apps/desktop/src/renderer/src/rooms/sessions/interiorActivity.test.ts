import type { Agent, Turn } from '@shared'
import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import {
  aSubagent as agent,
  aRoot,
  aToolCall as call,
  planEntries as entries,
  aTurn as turn,
} from './__fixtures__/runtimeTree'
import { buildActivity } from './interiorActivity'

const rootWith = (turns: Turn[], compactions: Agent['compactions'] = []): Agent =>
  aRoot({ turns, compactions })

describe('buildActivity', () => {
  it('puts the open turn first and marks it open', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 'past' }), turn({ id: 'open', stopReason: null })])],
    })
    const { turns } = buildActivity(session)
    expect(turns.map(({ key }) => key)).toEqual(['turn:open', 'turn:past'])
    expect(turns[0]?.open).toBe(true)
    expect(turns[1]?.open).toBe(false)
  })

  // The property that matters: a card you are reading must not be renumbered when the agent answers
  // again. Counting from the oldest is what holds it, even though the list draws the newest first.
  it('numbers turns from the oldest, so a turn keeps its number as new ones arrive', () => {
    const two = [turn({ id: 'first' }), turn({ id: 'second' })]
    const before = buildActivity(sessionView({ id: 's', agents: [rootWith(two)] }))
    expect(before.turns.map(({ key, ordinal }) => [key, ordinal])).toEqual([
      ['turn:second', 2],
      ['turn:first', 1],
    ])

    const after = buildActivity(
      sessionView({
        id: 's',
        agents: [rootWith([...two, turn({ id: 'third', stopReason: null })])],
      }),
    )
    expect(after.turns.find(({ key }) => key === 'turn:first')?.ordinal).toBe(1)
    expect(after.turns[0]?.ordinal).toBe(3)
  })

  it('renders an uninferable stop reason as itself rather than guessing one', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 't', stopReason: 'unknown' })])],
    })
    expect(buildActivity(session).turns[0]?.stopReason).toBe('unknown')
  })

  it('marks the turn a compaction sits in front of, so history reads as continuous', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 'old' }), turn({ id: 'new' })], [{ beforeTurnId: 'new' }])],
    })
    const { turns } = buildActivity(session)
    expect(turns.find(({ key }) => key === 'turn:new')?.compactedBefore).toBe(true)
    expect(turns.find(({ key }) => key === 'turn:old')?.compactedBefore).toBe(false)
  })
})

// The plan belongs to the SESSION and the agent replaces it wholesale (ADR-0020), so there is one of
// it however many turns reported a version.
describe("buildActivity's plan", () => {
  it('counts plan progress off the entries the agent authored', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([
          turn({ id: 't', plan: { entries: entries('completed', 'in_progress', 'pending') } }),
        ]),
      ],
    })
    expect(buildActivity(session).plan).toEqual({
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
    expect(buildActivity(session).plan).toMatchObject({ done: 1, total: 2 })
  })

  it('draws one tracker for the session, never one per turn', () => {
    const withPlan = { entries: entries('completed', 'pending') }
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 'a', plan: withPlan }), turn({ id: 'b', plan: withPlan })])],
    })
    const { plan, turns } = buildActivity(session)
    expect(plan).not.toBeNull()
    expect(turns).toHaveLength(2)
    expect(turns.every((one) => !('plan' in one))).toBe(true)
  })
})

describe("buildActivity's item list", () => {
  // The split is the point, not the concatenation: a delegate's work and the root Agent's arrive in
  // two lists so the feed can head and indent them, and no surface has to re-derive whose call it is.
  it('splits the items into delegated work and this session’s own, in feed order', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([turn({ id: 't', toolCalls: [call({ id: 'c1' }), call({ id: 'c2' })] })]),
        agent({ id: 'a', label: 'lens' }),
      ],
    })
    const { delegated, own } = buildActivity(session)
    expect(delegated.map(({ key, kind }) => [kind, key])).toEqual([['subagent', 'subagent:a']])
    expect(own.map(({ key, kind }) => [kind, key])).toEqual([
      ['step', 'step:c1'],
      ['step', 'step:c2'],
    ])
  })

  it('carries each subagent its own feed, so the detail pane never re-looks-it-up', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([]),
        agent({
          id: 'a',
          label: 'lens',
          turns: [turn({ id: 't', toolCalls: [call({ id: 'c', name: 'Grep' })] })],
        }),
      ],
    })
    const item = buildActivity(session).delegated[0]
    expect(item?.kind === 'subagent' && item.events.map(({ name }) => name)).toEqual(['Grep'])
  })

  it('renders an unparseable transcript as an empty surface, not an error', () => {
    const empty = buildActivity(sessionView({ id: 's' }))
    expect(empty).toEqual({ plan: null, subagents: null, turns: [], delegated: [], own: [] })
  })
})
