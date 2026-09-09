// The worktree-naming half of the guards, split from guards.test.mjs on file length alone. Both
// files reach pure decide() logic through the same three questions: does it leave the human
// alone, does it refuse the shape it exists to refuse, does it let the exempt shapes through.
//
// The convention itself: docs/agents/worktrees.md.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { configureNaming, decideName } from './worktree-names.mjs'

const bash = (command) => ({ toolName: 'Bash', toolInput: { command }, isAgent: true })

test('EnterWorktree with a path re-enters an existing tree', () => {
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
  assert.equal(
    decideName({
      toolName: 'EnterWorktree',
      toolInput: { path: '.claude/worktrees/x' },
      isAgent: true,
    }).block,
    false,
  )
})

test('EnterWorktree without a path cannot reach the convention, so it is refused', () => {
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
  const decision = decideName({
    toolName: 'EnterWorktree',
    toolInput: { name: 'x' },
    isAgent: true,
  })
  assert.equal(decision.block, true)
  assert.match(decision.reason, /git worktree add/)
})

test('an on-convention worktree add passes', () => {
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
  assert.equal(
    decideName(bash("git worktree add -b 'argo/#901-naming' .claude/worktrees/ticket-901-naming"))
      .block,
    false,
  )
})

test('an off-convention branch name is refused', () => {
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
  assert.equal(
    decideName(bash('git worktree add -b fix-stuff .claude/worktrees/ticket-901-naming')).block,
    true,
  )
})

test('an unset branchPrefix stops the guard judging branch names at all', () => {
  // What a consumer who has declared no convention gets (AGENTS.md, Cross-CLI guardrail hooks).
  configureNaming({ dir: '.claude/worktrees' })
  assert.equal(
    decideName(bash('git worktree add -b fix-stuff .claude/worktrees/ticket-x')).block,
    false,
  )
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
})

test('a publish namespace joins to no ticket, so the naming rule lets it through', () => {
  // A design page's branch carries a screen, not work (AGENTS.md, Design work). Without the
  // exemption the ticket-join rule below refuses every one of them.
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/', publishBranches: ['design/'] })
  assert.equal(
    decideName(bash("git worktree add -b 'design/#1730-shell' .claude/worktrees/ticket-1730-shell"))
      .block,
    false,
  )
  // The namespace exempts a branch from the ticket join, not from the shape. `design/2024-refresh`
  // is the case that matters: the reaper would read it as issue #2024 and delete the page.
  assert.equal(decideName(bash("git worktree add -b 'design/2024-refresh' x")).block, true)
  // A branch-create is only ours from inside a tree, so this half needs a cwd to be judged at all.
  const inTree = { ...bash("git switch -c 'design/#1730-shell'"), cwd: '.claude/worktrees/t-1' }
  assert.equal(decideName(inTree).block, false)
  configureNaming({ dir: '.claude/worktrees', branchPrefix: 'argo/' })
  assert.equal(decideName(inTree).block, true)
})
