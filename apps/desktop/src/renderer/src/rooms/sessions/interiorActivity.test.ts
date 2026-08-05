import type { Agent, Turn } from '@shared'
import { sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import { aRoot, aTurn as turn } from './__fixtures__/runtimeTree'
import { buildActivity } from './interiorActivity'

const rootWith = (turns: Turn[], compactions: Agent['compactions'] = []): Agent =>
  aRoot({ turns, compactions })

const navTurns = (session: Parameters<typeof buildActivity>[0]) =>
  buildActivity(session).sections.map(({ turn: nav }) => nav)

describe('buildActivity', () => {
  // The live turn is LAST, the way a chat puts the newest message at the bottom: the place new work
  // appears is the place the reader is already looking.
  it('puts the open turn last and marks it open', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 'past' }), turn({ id: 'open', stopReason: null })])],
    })
    const turns = navTurns(session)
    expect(turns.map(({ key }) => key)).toEqual(['turn:past', 'turn:open'])
    expect(turns[1]?.open).toBe(true)
    expect(turns[0]?.open).toBe(false)
  })

  // The property that matters: a card you are reading must not be renumbered when the agent answers
  // again. Counting from the oldest is what holds it.
  it('numbers turns from the oldest, so a turn keeps its number as new ones arrive', () => {
    const two = [turn({ id: 'first' }), turn({ id: 'second' })]
    const before = navTurns(sessionView({ id: 's', agents: [rootWith(two)] }))
    expect(before.map(({ key, ordinal }) => [key, ordinal])).toEqual([
      ['turn:first', 1],
      ['turn:second', 2],
    ])

    const after = navTurns(
      sessionView({
        id: 's',
        agents: [rootWith([...two, turn({ id: 'third', stopReason: null })])],
      }),
    )
    expect(after.find(({ key }) => key === 'turn:first')?.ordinal).toBe(1)
    expect(after.at(-1)?.ordinal).toBe(3)
  })

  it('renders an uninferable stop reason as itself rather than guessing one', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 't', stopReason: 'unknown' })])],
    })
    expect(navTurns(session)[0]?.stopReason).toBe('unknown')
  })

  it('marks the turn a compaction sits in front of, so history reads as continuous', () => {
    const session = sessionView({
      id: 's',
      agents: [rootWith([turn({ id: 'old' }), turn({ id: 'new' })], [{ beforeTurnId: 'new' }])],
    })
    const turns = navTurns(session)
    expect(turns.find(({ key }) => key === 'turn:new')?.compactedBefore).toBe(true)
    expect(turns.find(({ key }) => key === 'turn:old')?.compactedBefore).toBe(false)
  })

  it('renders an unparseable transcript as an empty surface, not an error', () => {
    const empty = buildActivity(sessionView({ id: 's' }))
    expect(empty.sections).toEqual([])
    expect(empty.agent).toEqual({ id: '', head: null, parent: null, live: false })
  })
})
