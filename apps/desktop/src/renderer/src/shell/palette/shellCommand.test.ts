import { describe, expect, it } from 'vitest'
import { shellCommand } from './shellCommand'

const press = (key: string, metaKey = true): { key: string; metaKey: boolean } => ({ key, metaKey })

describe('the canonical keymap', () => {
  it.each([
    { key: '1', room: 'sessions' },
    { key: '2', room: 'work' },
    { key: '3', room: 'code' },
  ] as const)('switches to the $room room on ⌘$key', ({ key, room }) => {
    expect(shellCommand(press(key))).toEqual({ kind: 'room', room })
  })

  it('walks to the previous project on ⌘[', () => {
    expect(shellCommand(press('['))).toEqual({ kind: 'project', step: -1 })
  })

  it('walks to the next project on ⌘]', () => {
    expect(shellCommand(press(']'))).toEqual({ kind: 'project', step: 1 })
  })

  it('opens the command palette on ⌘K', () => {
    expect(shellCommand(press('k'))).toEqual({ kind: 'palette' })
  })

  it('spawns a session on ⌘N', () => {
    expect(shellCommand(press('n'))).toEqual({ kind: 'spawn' })
  })

  it('reads a shortcut whatever the caps-lock state', () => {
    expect(shellCommand(press('N'))).toEqual({ kind: 'spawn' })
  })

  it('dismisses on Escape, which takes no modifier', () => {
    expect(shellCommand(press('Escape', false))).toEqual({ kind: 'dismiss' })
  })

  it('leaves an unmodified letter to whatever has focus', () => {
    expect(shellCommand(press('n', false))).toBeNull()
  })

  it('claims no shortcut it does not own', () => {
    expect(shellCommand(press('q'))).toBeNull()
  })
})
