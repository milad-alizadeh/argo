import { describe, expect, it } from 'vitest'
import { deriveLiveness } from './liveness'

const NOW = Date.parse('2026-07-20T12:00:00.000Z')

describe('deriveLiveness', () => {
  it('reads a matching process with a recent transcript as running, always DERIVED', () => {
    const status = deriveLiveness({ processMatch: true, lastTimestampMs: NOW, nowMs: NOW })
    expect(status).toEqual({ value: 'running', tier: 'derived' })
  })

  it('reads no matching process as orphaned — a vanished external process, not a claimed success', () => {
    const status = deriveLiveness({ processMatch: false, lastTimestampMs: NOW, nowMs: NOW })
    expect(status).toEqual({ value: 'orphaned', tier: 'derived' })
  })

  it('resolves down to orphaned when a matched process has a stale transcript (ambiguity)', () => {
    const staleHour = NOW + 60 * 60 * 1000
    const status = deriveLiveness({ processMatch: true, lastTimestampMs: NOW, nowMs: staleHour })
    expect(status).toEqual({ value: 'orphaned', tier: 'derived' })
  })

  it('never emits a false running and never upgrades the tier off recency alone', () => {
    const recentButDead = deriveLiveness({ processMatch: false, lastTimestampMs: NOW, nowMs: NOW })
    expect(recentButDead.value).not.toBe('running')
    expect(recentButDead.tier).toBe('derived')

    const noRecency = deriveLiveness({ processMatch: true, lastTimestampMs: null, nowMs: NOW })
    expect(noRecency.value).not.toBe('running')
    expect(noRecency.tier).toBe('derived')
  })
})
