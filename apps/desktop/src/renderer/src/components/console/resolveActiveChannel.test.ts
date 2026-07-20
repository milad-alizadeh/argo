import { describe, expect, it } from 'vitest'
import { type ConsoleCapture, LIVE_CHANNEL_ID } from './consoleChannels'
import { resolveActiveChannel } from './resolveActiveChannel'

const capture: ConsoleCapture = { id: 't-test', label: 'vitest @12:04', feed: '▸ ok' }

describe('resolveActiveChannel', () => {
  it('shows the capture the selection names', () => {
    expect(resolveActiveChannel('t-test', capture)).toBe('t-test')
  })

  it('shows live when live is selected', () => {
    expect(resolveActiveChannel(LIVE_CHANNEL_ID, capture)).toBe(LIVE_CHANNEL_ID)
    expect(resolveActiveChannel(LIVE_CHANNEL_ID, undefined)).toBe(LIVE_CHANNEL_ID)
  })

  it('returns to live when the selected capture was cleared by ✕', () => {
    expect(resolveActiveChannel('t-test', undefined)).toBe(LIVE_CHANNEL_ID)
  })

  it('returns to live when the slot was replaced by another feed', () => {
    expect(resolveActiveChannel('t-test', { ...capture, id: 't-lint' })).toBe(LIVE_CHANNEL_ID)
  })

  it('never resolves to a channel that is neither live nor the capture', () => {
    expect(resolveActiveChannel('', capture)).toBe(LIVE_CHANNEL_ID)
    expect(resolveActiveChannel('t-gone', capture)).toBe(LIVE_CHANNEL_ID)
  })
})
