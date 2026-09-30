import { describe, expect, test } from 'vitest'
import { sessionName } from './session-name'

describe('naming a Session', () => {
  test.each([
    {
      name: 'a titled Session reads its title',
      status: 'running',
      title: 'Fix the login bug',
      expected: 'Fix the login bug',
    },
    {
      name: 'a starting Session with no title reads the starting label',
      status: 'starting',
      title: null,
      expected: 'New Session',
    },
    {
      name: 'another untitled Session reads its id',
      status: 'idle',
      title: null,
      expected: 'session-1',
    },
  ] as const)('$name', ({ status, title, expected }) => {
    const named = title === null ? null : { text: title, source: 'first-prompt' as const }
    expect(sessionName({ id: 'session-1', status, title: named }, 'New Session')).toBe(expected)
  })
})
