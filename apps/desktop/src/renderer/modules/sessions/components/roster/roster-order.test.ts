import { describe, expect, test } from 'vitest'
import type { SessionsListed } from '../../types'
import { rememberedRosterOrder } from './roster-order'

type Sessions = SessionsListed['sessions']

function session(id: string, retiredIds: string[] = []) {
  return { id, retiredIds } as Sessions[number]
}

const idsOf = (sessions: Sessions) => sessions.map((entry) => entry.id)

describe('rememberedRosterOrder', () => {
  test('keeps the order the read returned when nothing is remembered', () => {
    const ordered = rememberedRosterOrder([session('a'), session('b'), session('c')], [])

    expect(idsOf(ordered)).toEqual(['a', 'b', 'c'])
  })

  test('holds a Session in place when a new message moves it up the read', () => {
    const ordered = rememberedRosterOrder(
      [session('c'), session('a'), session('b')],
      ['a', 'b', 'c'],
    )

    expect(idsOf(ordered)).toEqual(['a', 'b', 'c'])
  })

  test('trails the Sessions a wider window reveals, because they are older than every loaded row', () => {
    const wider = [session('a'), session('b'), session('c'), session('d'), session('e')]

    const ordered = rememberedRosterOrder(wider, ['a', 'b', 'c'])

    expect(idsOf(ordered)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  test('leads a Session created just now, because the read places it above every loaded row', () => {
    const ordered = rememberedRosterOrder([session('new'), session('a'), session('b')], ['a', 'b'])

    expect(idsOf(ordered)).toEqual(['new', 'a', 'b'])
  })

  test('holds a Session in place under the id it was remembered by before it retired', () => {
    const ordered = rememberedRosterOrder([session('b'), session('resumed', ['a'])], ['a', 'b'])

    expect(idsOf(ordered)).toEqual(['resumed', 'b'])
  })

  test('drops a remembered Session that the read no longer carries', () => {
    const ordered = rememberedRosterOrder([session('a'), session('c')], ['a', 'b', 'c'])

    expect(idsOf(ordered)).toEqual(['a', 'c'])
  })
})
