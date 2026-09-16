import { describe, expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import type { BrowserWindow, PowerMonitor } from 'electron'
import { watchSystemResume, watchWindowFocus } from './watch-signals'

// An Electron window and the power monitor are the two things here that cannot run for real outside
// a packaged app. Both are event emitters, so a plain one stands in and the wiring is the same.
function emitter() {
  return new EventEmitter()
}

describe('the signals that say the app may have been blind', () => {
  test('announces when the window takes focus', () => {
    const window = emitter()
    let changes = 0
    const watched = watchWindowFocus(window as unknown as BrowserWindow)(() => {
      changes += 1
    })
    window.emit('focus')
    window.emit('focus')
    expect(changes).toBe(2)
    watched()
    window.emit('focus')
    expect(changes).toBe(2)
  })

  test('announces when the machine wakes', () => {
    const power = emitter()
    let changes = 0
    const watched = watchSystemResume(power as unknown as PowerMonitor)(() => {
      changes += 1
    })
    power.emit('resume')
    expect(changes).toBe(1)
    watched()
    power.emit('resume')
    expect(changes).toBe(1)
  })

  test('leaves no listener behind once it is closed', () => {
    const power = emitter()
    watchSystemResume(power as unknown as PowerMonitor)(() => {})()
    expect(power.listenerCount('resume')).toBe(0)
  })
})
