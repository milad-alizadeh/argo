import { describe, expect, it } from 'vitest'
import { clampPercentage } from './ContextGauge'

describe('clampPercentage', () => {
  it('rounds a fractional estimate to a whole percent', () => {
    expect(clampPercentage(63.7)).toBe(64)
    expect(clampPercentage(63.4)).toBe(63)
  })

  it('clamps below zero to empty', () => {
    expect(clampPercentage(-0.4)).toBe(0)
    expect(clampPercentage(-20)).toBe(0)
  })

  it('clamps above a hundred to full', () => {
    expect(clampPercentage(100.4)).toBe(100)
    expect(clampPercentage(140)).toBe(100)
  })

  it('leaves the ends themselves alone', () => {
    expect(clampPercentage(0)).toBe(0)
    expect(clampPercentage(100)).toBe(100)
  })
})
