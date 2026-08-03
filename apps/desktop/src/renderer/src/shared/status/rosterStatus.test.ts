import {
  type CiStatus,
  lifecycleModel,
  type SessionFactsInput,
  type SessionPosture,
  type SessionStatus,
  sessionFacts,
} from '@shared'
import { describe, expect, it } from 'vitest'
import { deliveryState } from './deliveryState'
import { deliveryClaimWord, sessionStatusWord } from './rosterStatus'

const HEAD = 'a1b2c3d'
const OLD = '9f0e1d2'
const PR = { num: 42, state: 'open', base: 'main' } as const

/** A session whose branch has a PR with a check in the given state — the shape most of these cases
 * are about. A sha other than the head is a check that no longer speaks for the commit. */
const checked = (status: CiStatus, sha: string = HEAD): SessionFactsInput => ({
  headSha: HEAD,
  pr: PR,
  ci: { status, sha },
})

const railWord = (input: SessionFactsInput, posture: SessionPosture = 'managed') =>
  deliveryState(sessionFacts(input), posture).rail.word

const claimOf = (input: SessionFactsInput) => {
  const facts = sessionFacts(input)
  return deliveryClaimWord(facts, lifecycleModel(facts))
}

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

describe('the delivery claim', () => {
  it('makes no claim over a session with no lifecycle', () => {
    expect(claimOf({})).toBeNull()
  })

  it('makes no claim over a tree that has produced nothing to deliver yet', () => {
    expect(claimOf({ dirty: 3, agent: 'idle', status: 'idle' })).toBeNull()
  })

  it('reports a failing check even while a dirty tree owns the lifecycle head', () => {
    expect(claimOf({ dirty: 3, ...checked('failed') })).toBe('CI failed')
  })

  it('reports a check that stopped speaking for the head commit over the dirty tree above it', () => {
    expect(claimOf({ dirty: 3, ...checked('passed', OLD) })).toBe('blocked')
  })

  it('claims CI running while CI owns the head', () => {
    expect(claimOf(checked('running'))).toBe('CI running')
  })

  it('claims CI failed on a failing check', () => {
    expect(claimOf(checked('failed'))).toBe('CI failed')
  })

  it('names the PR by its own number once a review round is under way', () => {
    const review = [{ by: '@sam', verdict: 'running', sha: HEAD, findings: 0 }] as const
    expect(claimOf({ ...checked('passed'), review: [...review] })).toBe('PR #42')
  })

  it('claims blocked once a check no longer speaks for the head commit', () => {
    expect(claimOf(checked('passed', OLD))).toBe('blocked')
  })

  it('claims landed on a merged PR', () => {
    expect(claimOf({ headSha: HEAD, pr: { num: 38, state: 'merged', base: 'main' } })).toBe(
      'landed',
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
    expect(railWord({ status: 'permission', ...checked('failed') })).toBe('needs you')
  })

  it('reports the CI failure over the idle session under it', () => {
    expect(railWord({ status: 'idle', ...checked('failed') })).toBe('CI failed')
  })

  it('reads CI failed rather than running, because a delivery claim beats session status', () => {
    expect(railWord({ status: 'running', ...checked('failed') })).toBe('CI failed')
  })

  it('keeps a crashed session ahead of the CI failure beside it', () => {
    expect(railWord({ status: 'stopped', ...checked('failed') })).toBe('failed')
  })

  it('reports the landing over the idle session under it', () => {
    const merged = { num: 38, state: 'merged', base: 'main' } as const
    expect(railWord({ status: 'idle', headSha: HEAD, pr: merged })).toBe('landed')
  })

  it('blocks ahead of the liveness word', () => {
    expect(railWord({ status: 'running', ...checked('passed', OLD) })).toBe('blocked')
  })

  it('names an external session read-only even while it is running', () => {
    expect(railWord({ status: 'running' }, 'external')).toBe('read-only')
  })

  it('falls to liveness when nothing louder has a word', () => {
    expect(railWord({ status: 'idle' })).toBe('idle')
  })
})
