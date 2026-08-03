import { lifecycleModel, type SessionPosture, type SessionStatus, sessionFacts } from '@shared'
import { describe, expect, it } from 'vitest'
import { deliveryState } from './deliveryState'
import { deliveryClaimWord, type SessionDot, sessionDot, sessionStatusWord } from './rosterStatus'

const HEAD = 'a1b2c3d'
const OLD = '9f0e1d2'
const PR = { num: 42, state: 'open', base: 'main' } as const

const railWord = (input: Parameters<typeof sessionFacts>[0], posture: SessionPosture = 'managed') =>
  deliveryState(sessionFacts(input), posture).rail.word

const claimOf = (input: Parameters<typeof sessionFacts>[0]) =>
  deliveryClaimWord(lifecycleModel(sessionFacts(input)))

describe('the Session-status word', () => {
  const words: [SessionStatus, string][] = [
    ['running', 'running'],
    ['idle', 'idle'],
    ['permission', 'needs you'],
    ['asking', 'needs you'],
    ['stopped', 'failed'],
    ['ended', 'failed'],
  ]

  for (const [status, word] of words) {
    it(`names a ${status} session "${word}"`, () => {
      expect(sessionStatusWord(sessionFacts({ status }), 'managed')).toBe(word)
    })
  }

  for (const posture of ['external', 'orphaned'] as const) {
    it(`gives an ${posture} session no state word at all`, () => {
      expect(sessionStatusWord(sessionFacts({ status: 'running' }), posture)).toBeNull()
    })
  }
})

describe('the dot that carries the state', () => {
  // One row per status and the WHOLE dot: its tone, how hard its halo burns, whether it breathes,
  // and whether it is the state asking for you. Asserted wholesale, because the defect worth
  // catching is a state that took the right tone and another state's motion.
  const dots: [SessionStatus, SessionDot][] = [
    ['running', { tone: 'run', hollow: false, glow: 'live', pulse: true, attention: false }],
    ['permission', { tone: 'amber', hollow: false, glow: 'live', pulse: true, attention: true }],
    ['asking', { tone: 'amber', hollow: false, glow: 'live', pulse: true, attention: true }],
    ['stopped', { tone: 'red', hollow: false, glow: 'live', pulse: false, attention: false }],
    ['ended', { tone: 'red', hollow: false, glow: 'live', pulse: false, attention: false }],
    ['idle', { tone: 'gray', hollow: false, glow: 'quiet', pulse: false, attention: false }],
  ]

  for (const [status, dot] of dots) {
    it(`draws a ${status} session ${dot.tone}, ${dot.glow}, ${dot.pulse ? 'breathing' : 'still'}`, () => {
      expect(sessionDot(sessionFacts({ status }), 'managed')).toEqual(dot)
    })
  }

  for (const posture of ['external', 'orphaned'] as const) {
    it(`hollows an ${posture} session rather than colouring it`, () => {
      expect(sessionDot(sessionFacts({ status: 'running' }), posture)).toEqual({
        tone: 'gray',
        hollow: true,
        glow: 'faint',
        pulse: false,
        attention: false,
      })
    })
  }
})

describe('the delivery claim', () => {
  it('makes no claim over a session with no lifecycle', () => {
    expect(claimOf({})).toBeNull()
  })

  it('makes no claim while a dirty tree is still the head', () => {
    expect(claimOf({ dirty: 3, agent: 'idle', status: 'idle' })).toBeNull()
  })

  it('claims CI running while CI owns the head', () => {
    expect(claimOf({ headSha: HEAD, pr: PR, ci: { status: 'running', sha: HEAD } })).toBe(
      'CI running',
    )
  })

  it('claims CI failed on a failing check', () => {
    expect(claimOf({ headSha: HEAD, pr: PR, ci: { status: 'failed', sha: HEAD } })).toBe(
      'CI failed',
    )
  })

  it('claims PR open once a review round is under way', () => {
    expect(
      claimOf({
        headSha: HEAD,
        pr: PR,
        ci: { status: 'passed', sha: HEAD },
        review: [{ by: '@sam', verdict: 'running', sha: HEAD, findings: 0 }],
      }),
    ).toBe('PR open')
  })

  it('claims blocked once a check no longer speaks for the head commit', () => {
    expect(claimOf({ headSha: HEAD, pr: PR, ci: { status: 'passed', sha: OLD } })).toBe('blocked')
  })

  it('claims merged on a landed PR', () => {
    expect(claimOf({ headSha: HEAD, pr: { num: 38, state: 'merged', base: 'main' } })).toBe(
      'merged',
    )
  })

  it('makes no claim on a PR closed without merging', () => {
    expect(claimOf({ headSha: HEAD, pr: { num: 35, state: 'closed', base: 'main' } })).toBeNull()
  })
})

// The rail shows ONE word per row, so every tier boundary is only proven by a case that could
// have answered two ways. A case matching a single tier proves nothing about the order.
describe('the rail picks one word by priority', () => {
  it('asks you in first, over a CI failure it could have reported instead', () => {
    expect(
      railWord({
        status: 'permission',
        headSha: HEAD,
        pr: PR,
        ci: { status: 'failed', sha: HEAD },
      }),
    ).toBe('needs you')
  })

  it('reports the CI failure over the idle session under it', () => {
    expect(
      railWord({ status: 'idle', headSha: HEAD, pr: PR, ci: { status: 'failed', sha: HEAD } }),
    ).toBe('CI failed')
  })

  it('reads CI failed rather than running, because a delivery claim beats session status', () => {
    expect(
      railWord({ status: 'running', headSha: HEAD, pr: PR, ci: { status: 'failed', sha: HEAD } }),
    ).toBe('CI failed')
  })

  it('reports the merge over the idle session under it', () => {
    expect(
      railWord({ status: 'idle', headSha: HEAD, pr: { num: 38, state: 'merged', base: 'main' } }),
    ).toBe('merged')
  })

  it('blocks ahead of the liveness word', () => {
    expect(
      railWord({ status: 'running', headSha: HEAD, pr: PR, ci: { status: 'passed', sha: OLD } }),
    ).toBe('blocked')
  })

  it('names an external session read-only even while it is running', () => {
    expect(railWord({ status: 'running' }, 'external')).toBe('read-only')
  })

  it('falls to liveness when nothing louder has a word', () => {
    expect(railWord({ status: 'idle' })).toBe('idle')
  })
})
