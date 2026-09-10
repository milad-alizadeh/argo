// The commit half of the WHERE guard, which asks one question: is this commit being made in the
// shared main checkout? It was a husky `pre-commit` hook until #1911, and it has a test now that
// it is a `PreToolUse` one, because the shape it refuses is a string the hook parses rather than
// a `git rev-parse` the shell ran.
//
// Split from guards.test.mjs on file length alone. The convention: docs/agents/worktrees.md.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decideEdit } from './worktree-guard.mjs'

const ROOT = '/repo'
const WORKTREE = '/repo/.claude/worktrees/ticket-30-session-screen'

const commit = (command, cwd = ROOT) => ({
  toolName: 'Bash',
  toolInput: { command },
  command,
  cwd,
  projectDir: ROOT,
  isAgent: true,
})

test('a commit in the main checkout is refused, and the refusal names the override', () => {
  const decision = decideEdit(commit('git commit -m "wip"'))
  assert.equal(decision.block, true)
  assert.match(decision.reason, /ARGO_MAIN_COMMIT=1/)
  assert.match(decision.reason, /worktree/)
})

test('the same commit inside a worktree is allowed', () => {
  assert.equal(decideEdit(commit('git commit -m "wip"', WORKTREE)).block, false)
})

test('the human is never guarded', () => {
  assert.equal(decideEdit({ ...commit('git commit -m "wip"'), isAgent: false }).block, false)
})

test('the override prefix passes, for skills-lock.json after a reinstall', () => {
  assert.equal(
    decideEdit(commit('ARGO_MAIN_COMMIT=1 git commit -m "reinstall the bundle"')).block,
    false,
  )
})

test("git's own options are stepped over to reach the subcommand", () => {
  // `git --no-pager commit` and `rtk git commit` are the spellings this repo actually types, and
  // a matcher reading the second token alone lets both straight through.
  assert.equal(decideEdit(commit('git --no-pager commit -m "wip"')).block, true)
  assert.equal(decideEdit(commit('rtk git commit -m "wip"')).block, true)
})

test('a commit hidden behind a separator is still read', () => {
  assert.equal(decideEdit(commit('git add -A && git commit -m "wip"')).block, true)
})

test('a command that only names a commit is allowed', () => {
  // Reading history is read-only work, which the main checkout is for.
  assert.equal(decideEdit(commit('git log --format=%s -1')).block, false)
  assert.equal(decideEdit(commit('git show HEAD --stat')).block, false)
})

test('a heredoc quoting the command is data, not an invocation', () => {
  // Tracked files in this repo quote the guarded command inside heredocs; reading one as an
  // invocation denies any session rewriting the docs that describe the rule.
  assert.equal(decideEdit(commit("cat <<'EOF'\ngit commit -m x\nEOF")).block, false)
})
