import { lifecycleModel, type SessionStatus, sessionFacts } from '@shared'
import { describe, expect, it } from 'vitest'
import { rosterStatus } from './preRegistryStatus'

// The pre-registry table's own coverage, kept while `domains/roster` still renders it (issue 267
// Phase C deletes both). It is pinned rather than extended: the registry-derived words live in
// `rosterStatus.test.ts`.

const statusOf = (input: Parameters<typeof sessionFacts>[0]) => {
  const facts = sessionFacts(input)
  return rosterStatus(facts, lifecycleModel(facts))
}

describe('the pre-registry roster word', () => {
  const words: [SessionStatus, string][] = [
    ['running', 'Running'],
    ['permission', 'Needs you'],
    ['asking', 'Needs you'],
    ['idle', 'Idle'],
    ['stopped', 'Failed'],
    ['ended', 'Ended'],
  ]

  for (const [status, word] of words) {
    it(`speaks the Session's own word for a ribbonless ${status} session`, () => {
      expect(statusOf({ status }).word).toBe(word)
    })
  }

  it('carries the unpushed count in the word', () => {
    expect(
      statusOf({
        headSha: 'a1b2c3d',
        unpushed: 3,
        pr: { num: 42, state: 'open', base: 'main' },
        ci: { status: 'passed', sha: 'a1b2c3d' },
      }).word,
    ).toBe('↑3 unpushed')
  })

  it('keeps the word on Commits while a failed CI sits to its right', () => {
    expect(
      statusOf({
        headSha: 'a1b2c3d',
        dirty: 3,
        agent: 'idle',
        pr: { num: 12, state: 'open', base: 'main' },
        ci: { status: 'failed', sha: 'a1b2c3d' },
      }),
    ).toEqual({ word: 'Commit ready', tone: 'amber', icon: 'git-commit' })
  })
})
