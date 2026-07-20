import { type SessionStatus, sessionFacts } from '@shared'
import { describe, expect, it } from 'vitest'
import { shipState } from './shipState'

// The S-row table covers the ribbon-derived words; what is left is the fallback —
// a Session whose ribbon says nothing falls back to its own triage word.

describe('railStatus fallback', () => {
  const words: [SessionStatus, string][] = [
    ['running', 'Running'],
    ['needs-input', 'Needs input'],
    ['done', 'Done'],
    ['failed', 'Failed'],
    ['queued', 'Queued'],
    ['orphaned', 'Orphaned'],
  ]

  for (const [status, word] of words) {
    it(`speaks the Session's own word for a ribbonless ${status} session`, () => {
      expect(shipState(sessionFacts({ status })).rail.word).toBe(word)
    })
  }

  it('falls back while a working agent owns the Commits node', () => {
    expect(shipState(sessionFacts({ dirty: 3, agent: 'working' })).rail.word).toBe('Running')
  })

  it('carries the unpushed count in the word', () => {
    const facts = sessionFacts({
      headSha: 'a1b2c3d',
      unpushed: 3,
      pr: { num: 42, state: 'open', base: 'main' },
      ci: { status: 'passed', sha: 'a1b2c3d' },
    })
    expect(shipState(facts).rail.word).toBe('↑3 unpushed')
  })

  it('names the PR while CI owns the head', () => {
    const facts = sessionFacts({
      headSha: 'a1b2c3d',
      pr: { num: 7, state: 'open', base: 'main' },
      ci: { status: 'running', sha: 'a1b2c3d' },
    })
    expect(shipState(facts).rail.word).toBe('PR #7 · CI')
  })
})

// R1 puts the head at the leftmost unfinished node, and the row speaks for that
// node alone — a louder stage to its right never steals the word, or the rail and
// the ribbon would answer the same question differently.
describe('railStatus speaks for the head node', () => {
  it('keeps the word on Commits while a failed CI sits to its right', () => {
    const { ribbon, rail } = shipState(
      sessionFacts({
        headSha: 'a1b2c3d',
        dirty: 3,
        agent: 'idle',
        pr: { num: 12, state: 'open', base: 'main' },
        ci: { status: 'failed', sha: 'a1b2c3d' },
      }),
    )
    expect(ribbon?.head).toBe('commits')
    expect(ribbon?.nodes?.ci).toBe('fail')
    expect(rail).toEqual({ word: 'Commit ready', tone: 'amber', icon: 'git-commit' })
  })
})
