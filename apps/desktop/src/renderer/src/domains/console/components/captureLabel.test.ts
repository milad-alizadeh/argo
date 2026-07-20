import { describe, expect, it } from 'vitest'
import { captureLabel } from './captureLabel'

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
