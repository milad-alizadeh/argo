import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'vitest'
import { reportWindowVisibility } from './window-visibility'

// A macOS window that another window covers: Electron emits hide, yet isVisible() stays true.
test('a covered window reports hidden although isVisible() stays true', () => {
  const window = Object.assign(new EventEmitter(), {
    isVisible: () => true,
    isMinimized: () => false,
  })
  const reported: boolean[] = []
  reportWindowVisibility(window, (command) => {
    if (command.type === 'Visibility') reported.push(command.visible)
  })
  window.emit('hide')
  assert.deepEqual(reported, [true, false])
  window.emit('show')
  assert.deepEqual(reported, [true, false, true])
})
