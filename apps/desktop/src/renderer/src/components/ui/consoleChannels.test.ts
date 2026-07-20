import { describe, expect, it } from 'vitest'
import {
  type ConsoleCapture,
  captureLabel,
  feedLines,
  LIVE_CHANNEL_ID,
  resolveActiveChannel,
} from './consoleChannels'

const capture: ConsoleCapture = { id: 't-test', label: 'vitest @12:04', feed: '▸ ok' }

describe('captureLabel', () => {
  it('stamps the capture with the hour and minute it was taken', () => {
    expect(captureLabel('vitest', new Date(2026, 6, 20, 12, 4))).toBe('vitest @12:04')
  })

  it('zero-pads both halves so tabs stay a fixed-width column', () => {
    expect(captureLabel('tsc', new Date(2026, 6, 20, 9, 7))).toBe('tsc @09:07')
  })

  it('reads 24-hour, so an afternoon run cannot collide with a morning one', () => {
    expect(captureLabel('vitest', new Date(2026, 6, 20, 0, 0))).toBe('vitest @00:00')
    expect(captureLabel('vitest', new Date(2026, 6, 20, 23, 59))).toBe('vitest @23:59')
  })
})

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

describe('feedLines', () => {
  it('lifts the marker off a marked line', () => {
    expect(feedLines('▸ Bash: bunx vitest run')).toEqual([
      { marker: true, text: 'Bash: bunx vitest run' },
    ])
  })

  it('leaves an unmarked line whole', () => {
    expect(feedLines('  ✓ rotation.test.ts (7)')).toEqual([
      { marker: false, text: '  ✓ rotation.test.ts (7)' },
    ])
  })

  it('keeps blank lines so the feed keeps its own spacing', () => {
    expect(feedLines('▸ run\n\n done')).toEqual([
      { marker: true, text: 'run' },
      { marker: false, text: '' },
      { marker: false, text: ' done' },
    ])
  })

  it('treats a bare marker with no space after it as text', () => {
    expect(feedLines('▸run')).toEqual([{ marker: false, text: '▸run' }])
  })

  it('only lifts a marker that opens the line', () => {
    expect(feedLines('done ▸ next')).toEqual([{ marker: false, text: 'done ▸ next' }])
  })

  it('renders an empty feed as one empty line rather than nothing', () => {
    expect(feedLines('')).toEqual([{ marker: false, text: '' }])
  })
})
