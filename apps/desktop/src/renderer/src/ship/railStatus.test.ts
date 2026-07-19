import { describe, expect, it } from 'vitest'
import { railStatus } from './railStatus'
import { type SessionLifecycle, sessionFacts } from './sessionFacts'

// The S-row table covers the ribbon-derived words; what is left is the fallback —
// a Session whose ribbon says nothing falls back to its own triage word.

describe('railStatus fallback', () => {
  const words: [SessionLifecycle, string][] = [
    ['running', 'Running'],
    ['needs-input', 'Needs input'],
    ['done', 'Done'],
    ['failed', 'Failed'],
    ['queued', 'Queued'],
    ['orphaned', 'Orphaned'],
  ]

  for (const [lifecycle, word] of words) {
    it(`speaks the Session's own word for a ribbonless ${lifecycle} session`, () => {
      expect(railStatus(sessionFacts({ lifecycle })).word).toBe(word)
    })
  }

  it('falls back while a working agent owns the Commits node', () => {
    expect(railStatus(sessionFacts({ dirty: 3, agent: 'working' })).word).toBe('Running')
  })

  it('carries the unpushed count in the word', () => {
    const facts = sessionFacts({
      headSha: 'a1b2c3d',
      unpushed: 3,
      pr: { num: 42, state: 'open', base: 'main' },
      ci: { status: 'passed', sha: 'a1b2c3d' },
    })
    expect(railStatus(facts).word).toBe('↑3 unpushed')
  })

  it('names the PR while CI owns the head', () => {
    const facts = sessionFacts({
      headSha: 'a1b2c3d',
      pr: { num: 7, state: 'open', base: 'main' },
      ci: { status: 'running', sha: 'a1b2c3d' },
    })
    expect(railStatus(facts).word).toBe('PR #7 · CI')
  })
})
