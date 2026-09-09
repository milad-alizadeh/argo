// Who may push a branch and open a pull request, split from guards.test.mjs on file length alone.
// The same three questions as every guard here: does it leave the human alone, does it refuse the
// shape it exists to refuse, does it let the exempt shapes through.
//
// The rule itself: AGENTS.md, Landing.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configurePublish, decide as decidePublish, SHIP_MARKER } from './pr-ownership-guard.mjs'

const bash = (command) => ({ toolName: 'Bash', toolInput: { command }, isAgent: true })

test('the human is never guarded', () => {
  assert.equal(
    decidePublish({ toolName: 'Bash', toolInput: { command: 'git push' }, isAgent: false }).block,
    false,
  )
})

test('an agent pushing a work branch is refused, and told how', () => {
  const decision = decidePublish(bash('git push -u origin HEAD'))
  assert.equal(decision.block, true)
  assert.match(decision.reason, /\/ship/)
  assert.match(decision.reason, new RegExp(SHIP_MARKER))
})

test('an agent opening a pull request is refused, under both spellings', () => {
  for (const action of ['create', 'new']) {
    assert.equal(decidePublish(bash(`gh pr ${action} --base main`)).block, true, action)
  }
})

test('the guard reads every segment, not just the first', () => {
  assert.equal(decidePublish(bash('git status && git push -u origin HEAD')).block, true)
})

test('the ship marker is the opt-out, and survives an rtk wrapper', () => {
  assert.equal(decidePublish(bash(`${SHIP_MARKER} git push -u origin HEAD`)).block, false)
  assert.equal(decidePublish(bash(`rtk ${SHIP_MARKER} gh pr create --base main`)).block, false)
})

test('a push that deletes a ref is not publishing work', () => {
  assert.equal(decidePublish(bash('git push origin --delete design/inbox')).block, false)
})

test('a push to a ref outside refs/heads is evidence, not a work branch', () => {
  // pixel-review's PNG evidence ref.
  assert.equal(
    decidePublish(bash('git push --force origin abc123:refs/evidence/issue-7')).block,
    false,
  )
})

test('an unexpanded refspec earns no opinion rather than a refusal', () => {
  assert.equal(decidePublish(bash('git push origin "$commit:$ref"')).block, false)
})

test('a git subcommand that is not push is left alone', () => {
  assert.equal(decidePublish(bash('git fetch origin')).block, false)
  assert.equal(decidePublish(bash('gh pr view 12 --json body')).block, false)
})

test('a non-Bash tool call is left alone', () => {
  assert.equal(decidePublish({ toolName: 'Read', toolInput: {}, isAgent: true }).block, false)
})

test('a push into a publish namespace is not a work branch', () => {
  // A design page's branch joins to no ticket and never merges, so `/ship` has no step that
  // pushes it. Without this the process it serves has no way to publish at all.
  configurePublish({ publishBranches: ['design/'] })
  assert.equal(decidePublish(bash("git push -u origin 'design/#1730-app-shell'")).block, false)
  assert.equal(decidePublish(bash("git push origin 'HEAD:refs/heads/design/#1730-x'")).block, false)
  // The exemption is per namespace, not a hole: a work branch alongside one is still refused.
  assert.equal(
    decidePublish(bash("git push origin 'argo/#1730-app-shell' 'design/#1730-x'")).block,
    true,
  )
  // Unconfigured, every push is judged as work, which is what a consumer who declared no
  // publish namespace gets.
  configurePublish({})
  assert.equal(decidePublish(bash("git push -u origin 'design/#1730-app-shell'")).block, true)
})
