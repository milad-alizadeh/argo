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

  it('renders an uninferable stop reason as itself rather than guessing one', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 't', stopReason: 'unknown' })])],
    })
    expect(buildActivity(session).turns[0]?.stopReason).toBe('unknown')
  })

  it('counts plan progress off the entries the agent authored', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([
          turn({ id: 't', plan: { entries: entries('completed', 'in_progress', 'pending') } }),
        ]),
      ],
    })
    expect(buildActivity(session).turns[0]?.plan).toEqual({
      done: 1,
      total: 3,
      entries: entries('completed', 'in_progress', 'pending'),
    })
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
    expect(empty).toEqual({ subagents: null, turns: [], delegated: [], own: [] })
  })
})
