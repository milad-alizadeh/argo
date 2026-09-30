import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ticketKeyInBranch } from './branch-ticket'

const CASES: [string | null, string | null][] = [
  ['argo/#2428-issue-completion', '#2428'],
  ['#607', '#607'],
  ['feature/ENG-12-login', 'ENG-12'],
  ['codex/session-feed-hydration-repair', null],
  ['main', null],
  ['release-2026-09', null],
  [null, null],
]

test('a branch name yields the Ticket key it carries, or nothing', () => {
  for (const [branch, key] of CASES) assert.equal(ticketKeyInBranch(branch), key, branch ?? 'null')
})
