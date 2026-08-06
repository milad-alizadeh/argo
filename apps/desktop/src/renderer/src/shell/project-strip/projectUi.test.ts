import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_UI, nextProjectId, recallProjectUi, rememberProjectUi } from './projectUi'

describe('swapping projects', () => {
  it('opens a project never visited before in the Sessions room', () => {
    expect(recallProjectUi({}, 'p1')).toEqual(DEFAULT_PROJECT_UI)
  })

  it('lands you back in the room you left a project in', () => {
    const memory = rememberProjectUi({}, 'p1', { room: 'code', selectedSessionId: null })
    expect(recallProjectUi(memory, 'p1').room).toBe('code')
  })

  it('restores the session you had open in that project', () => {
    const memory = rememberProjectUi({}, 'p1', { room: 'sessions', selectedSessionId: 's7' })
    expect(recallProjectUi(memory, 'p1').selectedSessionId).toBe('s7')
  })

  it('remembers each project separately', () => {
    const first = rememberProjectUi({}, 'p1', { room: 'work', selectedSessionId: null })
    const both = rememberProjectUi(first, 'p2', { room: 'code', selectedSessionId: null })
    expect([recallProjectUi(both, 'p1').room, recallProjectUi(both, 'p2').room]).toEqual([
      'work',
      'code',
    ])
  })
})

describe('walking the project strip', () => {
  const strip = ['p1', 'p2', 'p3']

  it('steps to the next project in strip order', () => {
    expect(nextProjectId(strip, 'p1', 1)).toBe('p2')
  })

  it('steps to the previous project in strip order', () => {
    expect(nextProjectId(strip, 'p2', -1)).toBe('p1')
  })

  it('wraps past the end of the strip', () => {
    expect(nextProjectId(strip, 'p3', 1)).toBe('p1')
  })

  it('wraps before the start of the strip', () => {
    expect(nextProjectId(strip, 'p1', -1)).toBe('p3')
  })

  it('stays put when there is only one project', () => {
    expect(nextProjectId(['p1'], 'p1', 1)).toBe('p1')
  })

  it('walks nowhere when no project is connected', () => {
    expect(nextProjectId([], null, 1)).toBeNull()
  })
})
