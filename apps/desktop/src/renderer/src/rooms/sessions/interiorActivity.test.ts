import type { Agent, Turn } from '@shared'
import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import {
  aSubagent as agent,
  aRoot,
  aToolCall as call,
  aTurn as turn,
} from './__fixtures__/runtimeTree'
import { buildActivity } from './interiorActivity'

const rootWith = (turns: Turn[], compactions: Agent['compactions'] = []): Agent =>
  aRoot({ turns, compactions })

describe('buildActivity', () => {
  // The live turn is LAST, the way a chat puts the newest message at the bottom: the place new work
  // appears is the place the reader is already looking.
  it('puts the open turn last and marks it open', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 'past' }), turn({ id: 'open', stopReason: null })])],
    })
    const { turns } = buildActivity(session)
    expect(turns.map(({ key }) => key)).toEqual(['turn:past', 'turn:open'])
    expect(turns[1]?.open).toBe(true)
    expect(turns[0]?.open).toBe(false)
  })

  // The property that matters: a card you are reading must not be renumbered when the agent answers
  // again. Counting from the oldest is what holds it.
  it('numbers turns from the oldest, so a turn keeps its number as new ones arrive', () => {
    const two = [turn({ id: 'first' }), turn({ id: 'second' })]
    const before = buildActivity(sessionView({ id: 's', agents: [rootWith(two)] }))
    expect(before.turns.map(({ key, ordinal }) => [key, ordinal])).toEqual([
      ['turn:first', 1],
      ['turn:second', 2],
    ])

    const after = buildActivity(
      sessionView({
        id: 's',
        agents: [rootWith([...two, turn({ id: 'third', stopReason: null })])],
      }),
    )
    expect(after.turns.find(({ key }) => key === 'turn:first')?.ordinal).toBe(1)
    expect(after.turns.at(-1)?.ordinal).toBe(3)
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
    expect(own.map(({ key, kind }) => [kind, key])).toEqual([['turn', 'turn:t']])
  })

  it('renders an unparseable transcript as an empty surface, not an error', () => {
    const empty = buildActivity(sessionView({ id: 's' }))
    expect(empty).toEqual({ plan: null, subagents: null, turns: [], delegated: [], own: [] })
  })
})

describe('the feed the own items carry', () => {
  // The two panes are ONE list read twice. A navigation row above another whose section is below it
  // would make the highlight travel backwards as the reader scrolls.
  it('runs the feed in the same order as the timeline list, oldest first', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 'first' }), turn({ id: 'second', stopReason: null })])],
    })
    const { own, turns } = buildActivity(session)

    expect(own.map(({ key }) => key)).toEqual(['turn:first', 'turn:second'])
    expect(turns.map(({ key }) => key)).toEqual(['turn:first', 'turn:second'])
  })

  it('carries each turn its own prose rows, under the ordinal its navigation row wears', () => {
    const session = sessionView({
      id: 's',
      agents: [
        rootWith([
          turn({
            id: 't',
            prose: [
              { kind: 'thought', markdown: 'weigh it' },
              { kind: 'message', markdown: 'wired' },
            ],
          }),
        ]),
      ],
    })
    const item = buildActivity(session).own[0]

    expect(item?.kind === 'turn' && item.rows.map(({ kind }) => kind)).toEqual([
      'thought',
      'message',
    ])
    // The section and its navigation row wear ONE ordinal and one key, not two derivations of them.
    expect(item?.kind === 'turn' && item.ordinal).toBe(1)
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
})
