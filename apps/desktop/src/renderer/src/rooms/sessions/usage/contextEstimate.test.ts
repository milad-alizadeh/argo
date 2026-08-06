import { type Agent, sessionView, type Usage } from '@shared'
import { describe, expect, it } from 'vitest'
import { aRoot, aTurn, aUsage as usage } from '../__fixtures__/runtimeTree'
import { contextPercent, contextWindow, sessionUsage } from './contextEstimate'

const root = (usages: (Usage | null)[]): Agent =>
  aRoot({ turns: usages.map((carried, index) => aTurn({ id: `t${index}`, usage: carried })) })

// Turns carrying only what each one saw in the window — the reading the ring divides by.
const inWindow = (readings: (number | null)[]): Agent =>
  aRoot({
    turns: readings.map((tokens, index) => aTurn({ id: `t${index}`, contextTokens: tokens })),
  })

describe('contextWindow', () => {
  it('reads the window off the model-id prefix a transcript reported', () => {
    expect(contextWindow('claude-opus-5')).toBe(200_000)
    expect(contextWindow('gpt-5-codex')).toBe(400_000)
  })

  it('multiplies the window for the long-context variant marker', () => {
    expect(contextWindow('claude-opus-5[1m]')).toBe(1_000_000)
  })

  it('refuses to guess a window for a model it does not know', () => {
    expect(contextWindow('some-new-model')).toBeNull()
    expect(contextWindow(null)).toBeNull()
  })
})

describe('contextPercent', () => {
  it("reads the newest turn's own window reading", () => {
    const session = sessionView({
      id: 's',
      model: 'claude-opus-5',
      agents: [inWindow([1_000, 50_000])],
    })
    expect(contextPercent(session)).toBeCloseTo(25)
  })

  // THE bug this field exists for: a turn's `usage` sums every request it made, so a long turn's
  // spend is several times the window it re-read — which put a fresh session at `~100%`.
  it('reads the window rather than the turn spend, which sums every request', () => {
    const session = sessionView({
      id: 's',
      model: 'claude-opus-5',
      agents: [
        aRoot({
          turns: [
            aTurn({
              id: 't0',
              contextTokens: 40_000,
              usage: usage({ inputTokens: 400_000, cacheReadTokens: 400_000 }),
            }),
          ],
        }),
      ],
    })
    expect(contextPercent(session)).toBeCloseTo(20)
  })

  it('falls back to the newest turn that carried a reading at all', () => {
    const session = sessionView({
      id: 's',
      model: 'claude-opus-5',
      agents: [inWindow([100_000, null])],
    })
    expect(contextPercent(session)).toBeCloseTo(50)
  })

  it('claims nothing for a session Argo only observes, even with a window reading on the record', () => {
    const session = sessionView({
      id: 's',
      posture: 'external',
      model: 'claude-opus-5',
      agents: [inWindow([100_000])],
    })
    expect(contextPercent(session)).toBeNull()
  })

  it('claims nothing when either half of the estimate is missing', () => {
    const noModel = sessionView({ id: 's', agents: [inWindow([10])] })
    const noUsage = sessionView({ id: 's', model: 'claude-opus-5', agents: [inWindow([null])] })
    const noTree = sessionView({ id: 's', model: 'claude-opus-5' })
    expect(contextPercent(noModel)).toBeNull()
    expect(contextPercent(noUsage)).toBeNull()
    expect(contextPercent(noTree)).toBeNull()
  })
})

describe('sessionUsage', () => {
  it('rolls every observed turn up to the Session', () => {
    const session = sessionView({
      id: 's',
      agents: [root([usage({ inputTokens: 5, outputTokens: 1 }), usage({ inputTokens: 7 })])],
    })
    expect(sessionUsage(session)).toEqual(usage({ inputTokens: 12, outputTokens: 1 }))
  })

  it('stays null where no turn carried usage', () => {
    expect(sessionUsage(sessionView({ id: 's', agents: [root([null])] }))).toBeNull()
  })
})
