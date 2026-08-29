#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the worktree-naming guardrail hook, run via `bun run test:hooks`.
// Both halves matter equally: a guard that blocks legitimate work stops every concurrent
// session on the machine, so the permitted cases below are as load-bearing as the refusals.
// Soften the script and this test together, never one alone.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'
import { decide } from './worktree-name-guard.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOOK = path.join(HERE, 'worktree-name-guard.mjs')

const bash = (command, cwd = '/repo') =>
  decide({ toolName: 'Bash', toolInput: { command }, cwd, isAgent: true })
const enter = (toolInput) => decide({ toolName: 'EnterWorktree', toolInput, isAgent: true })
const WT = '.claude/worktrees'

// Refused: the three shapes actually found in this repo by #901.
check('refuses a worktree-* branch', () =>
  assert.equal(
    bash(`git worktree add -b worktree-885-screenshot-pid-scope ${WT}/885-screenshot-pid-scope`)
      .block,
    true,
  ),
)
check('refuses a directory with the number but no ticket- prefix', () =>
  assert.equal(bash(`git worktree add ${WT}/885-screenshot-pid-scope`).block, true),
)
check('refuses a bare slug directory', () =>
  assert.equal(bash(`git worktree add ${WT}/parallel-workitem-edges`).block, true),
)
check('refuses an EnterWorktree name off-convention', () =>
  assert.equal(enter({ name: 'parallel-workitem-edges' }).block, true),
)
check('refuses a numberless name that starts with a number (a dropped #)', () =>
  assert.equal(bash(`git worktree add -b argo/901-naming ${WT}/ticket-901-naming`).block, true),
)
check('refuses a worktree outside .claude/worktrees/', () =>
  assert.equal(bash('git worktree add ../ticket-901-naming').block, true),
)
check('sees the command inside a compound one', () =>
  assert.equal(bash(`cd /repo && git worktree add ${WT}/nope && cd -`).block, true),
)
check('refuses a rename to an off-convention branch inside a worktree', () =>
  assert.equal(
    bash('git branch -m worktree-ticket-901-naming', `/repo/${WT}/ticket-901-naming`).block,
    true,
  ),
)

// The refusal has to name the right shape, or every future session pays a lookup.
check('the refusal spells out both names and cites the doc', () => {
  const { reason } = bash(`git worktree add ${WT}/parallel-workitem-edges`)
  assert.match(reason, /ticket-<N>-<slug>/)
  assert.match(reason, /argo\/#<N>-<slug>/)
  assert.match(reason, /ticket-<slug>/) // the numberless shape, not a dead end
  assert.match(reason, /docs\/agents\/worktrees\.md/)
})

// Permitted: everything the documented workflow actually does.
check('allows the documented numbered creation', () =>
  assert.equal(
    bash(`git worktree add -b argo/#901-worktree-naming ${WT}/ticket-901-worktree-naming`).block,
    false,
  ),
)
check('allows the documented numberless shape (work with no ticket)', () =>
  assert.equal(
    bash(`git worktree add -b argo/verbs-detail-pane ${WT}/ticket-verbs-detail-pane`).block,
    false,
  ),
)
check('allows EnterWorktree with a conforming name', () =>
  assert.equal(enter({ name: 'ticket-901-worktree-naming' }).block, false),
)
check('allows re-entering an existing tree by path (this is how #901s three trees drain)', () =>
  assert.equal(enter({ path: `${WT}/parallel-workitem-edges` }).block, false),
)
check('allows the documented recovery of a pushed branch (no -b)', () =>
  assert.equal(
    bash(`git worktree add ${WT}/ticket-30-session-screen argo/#30-session-screen`).block,
    false,
  ),
)
check('allows the documented rename to argo/#<N>-<slug>', () =>
  assert.equal(
    bash('git branch -m argo/#901-worktree-naming', `/repo/${WT}/ticket-901-worktree-naming`).block,
    false,
  ),
)
check('ignores a branch rename outside any worktree', () =>
  assert.equal(bash('git branch -m something-else', '/repo').block, false),
)
check('ignores every other git command', () =>
  assert.equal(
    bash('git worktree list && git status && git branch --list "argo/#901-*"').block,
    false,
  ),
)
check('ignores an unrelated Bash command mentioning a worktree', () =>
  assert.equal(bash(`ls ${WT}/parallel-workitem-edges`).block, false),
)
check('never guards the human workflow (no agent marker)', () =>
  assert.equal(
    decide({ toolName: 'Bash', toolInput: { command: `git worktree add ${WT}/nope` } }).block,
    false,
  ),
)
check('ignores a tool call with no command', () =>
  assert.equal(decide({ toolName: 'Bash', toolInput: {}, isAgent: true }).block, false),
)

// End-to-end: the wired script emits a PreToolUse deny, and stays silent otherwise.
const run = (payload, env) =>
  execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    env: { ...process.env, CLAUDECODE: '', ARGO_HOOK_AGENT: '', ...env },
    encoding: 'utf8',
  })

check('script emits deny JSON for an off-convention creation', () => {
  const out = run(
    { tool_name: 'Bash', tool_input: { command: `git worktree add ${WT}/nope` }, cwd: '/repo' },
    { CLAUDECODE: '1' },
  )
  const parsed = JSON.parse(out)
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny')
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /ticket-<N>-<slug>/)
})

// Cross-CLI: Codex has no CLAUDECODE and sends camelCase toolInput.
check('script blocks via ARGO_HOOK_AGENT on a camelCase payload', () => {
  const out = run(
    { toolName: 'Bash', toolInput: { command: `git worktree add ${WT}/nope` }, cwd: '/repo' },
    { ARGO_HOOK_AGENT: '1' },
  )
  assert.equal(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny')
})

check('script stays silent for a conforming creation', () => {
  const out = run(
    {
      tool_name: 'Bash',
      tool_input: { command: `git worktree add -b argo/#901-naming ${WT}/ticket-901-naming` },
      cwd: '/repo',
    },
    { CLAUDECODE: '1' },
  )
  assert.equal(out.trim(), '')
})

check('script stays silent for the human (no agent marker)', () => {
  const out = run({
    tool_name: 'Bash',
    tool_input: { command: `git worktree add ${WT}/nope` },
    cwd: '/repo',
  })
  assert.equal(out.trim(), '')
})

report('worktree-name-guard')
