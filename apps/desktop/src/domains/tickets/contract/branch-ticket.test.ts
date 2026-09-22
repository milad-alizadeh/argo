import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ticketKeyInBranch, ticketKeyInPlace } from './branch-ticket'

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

const WORKTREE = '/Users/x/argo/.claude/worktrees/ticket-2375-session-search-shared-reader'

// Claude Code writes `gitBranch: "HEAD"` inside a worktree.
test('the worktree folder names the Ticket when the branch does not', () => {
  assert.equal(ticketKeyInPlace('HEAD', WORKTREE), '#2375')
  assert.equal(ticketKeyInPlace(null, WORKTREE), '#2375')
  assert.equal(ticketKeyInPlace('HEAD', `${WORKTREE}/apps/desktop`), '#2375')
  assert.equal(ticketKeyInPlace('argo/#2428-issue-completion', WORKTREE), '#2428')
  assert.equal(ticketKeyInPlace('main', '/Users/x/argo'), null)
  assert.equal(ticketKeyInPlace('main', '/Users/x/tickets/'), null)
  assert.equal(ticketKeyInPlace(null, null), null)
})
