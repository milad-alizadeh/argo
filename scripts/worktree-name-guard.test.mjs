#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the worktree-naming guardrail hook, run via `bun run test:hooks`.
// Both halves matter equally: this hook denies Bash for every agent session running against the
// repo at once, so a false refusal stops real work everywhere and the PERMITTED table is as
// load-bearing as the REFUSED one. Soften the script and this test together, never one alone.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'
import { decide } from './worktree-name-guard.mjs'

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'worktree-name-guard.mjs')
const WT = '.claude/worktrees'
const IN_WT = `/repo/${WT}/ticket-901-naming`
const OK = `-b argo/#901-naming ${WT}/ticket-901-naming`

const bash = (command, cwd = '/repo') =>
  decide({ toolName: 'Bash', toolInput: { command }, cwd, isAgent: true })
const enter = (toolInput) => decide({ toolName: 'EnterWorktree', toolInput, isAgent: true })

// The first three rows are the shapes #901 actually found in this repo.
const REFUSED = [
  ['a worktree-* branch', () => bash(`git worktree add -b worktree-885-pid ${WT}/885-pid`)],
  [
    'a directory with the number but no ticket- prefix',
    () => bash(`git worktree add ${WT}/885-pid`),
  ],
  ['a bare slug directory', () => bash(`git worktree add ${WT}/parallel-workitem-edges`)],
  ['an EnterWorktree name off-convention', () => enter({ name: 'parallel-workitem-edges' })],
  // A numberless name starting with a number is a dropped `#`, not a statement of no ticket.
  [
    'a numberless name that starts with a number',
    () => bash(`git worktree add -b argo/901-naming ${WT}/ticket-901-naming`),
  ],
  ['a worktree outside .claude/worktrees/', () => bash('git worktree add ../ticket-901-naming')],
  ['a creation inside a compound command', () => bash(`cd /repo && git worktree add ${WT}/nope`)],
  // git's own options precede the subcommand — `git -C` is natural for an agent whose cwd resets.
  ['a creation behind git -C', () => bash(`git -C /repo worktree add ${WT}/nope`)],
  // Each name can be right alone and still not name the same work; that is `885-pid`'s defect.
  [
    'a pair whose number is in the directory only',
    () => bash(`git worktree add -b argo/naming ${WT}/ticket-901-naming`),
  ],
  [
    'a pair whose numbers disagree',
    () => bash(`git worktree add -b argo/#12-naming ${WT}/ticket-901-naming`),
  ],
  ['a pair whose slugs disagree', () => bash(`git worktree add -b argo/#901-a ${WT}/ticket-901-b`)],
  // A rename is not the only road onto an off-convention branch.
  [
    'a rename off-convention inside a worktree',
    () => bash('git branch -M worktree-901-naming', IN_WT),
  ],
  ['git switch -c onto a bare name inside a worktree', () => bash('git switch -c wip', IN_WT)],
  ['git checkout -b onto a bare name inside a worktree', () => bash('git checkout -b wip', IN_WT)],
]

for (const [name, run] of REFUSED) check(`refuses ${name}`, () => assert.equal(run().block, true))

const PERMITTED = [
  ['the documented numbered creation', () => bash(`git worktree add ${OK}`)],
  [
    'the documented numberless shape (work with no ticket)',
    () => bash(`git worktree add -b argo/verbs-pane ${WT}/ticket-verbs-pane`),
  ],
  ['an EnterWorktree name that conforms', () => enter({ name: 'ticket-901-naming' })],
  // How a tree named before this guard, and the agent inside it, drain rather than break.
  ['re-entering an existing tree by path', () => enter({ path: `${WT}/parallel-workitem-edges` })],
  [
    'the documented recovery of a pushed branch (no -b)',
    () => bash(`git worktree add ${WT}/ticket-30-screen argo/#30-screen`),
  ],
  [
    'the documented rename to argo/#<N>-<slug>',
    () => bash('git branch -m argo/#901-naming', IN_WT),
  ],
  ['git switch -c onto a conforming branch', () => bash('git switch -c argo/#901-naming', IN_WT)],
  // Two names prove the target is not the branch in hand, so it is not this guard's business.
  ['a two-argument rename of some other branch', () => bash('git branch -m stale cleanup', IN_WT)],
  ['a branch rename outside any worktree', () => bash('git branch -m something-else')],
  [
    'the resume check /implement runs before creating anything',
    () => bash('git worktree list && git branch --list "argo/#901-*"'),
  ],
  ['a listing of an off-convention tree', () => bash(`ls ${WT}/parallel-workitem-edges`)],
  // Shell forms of a conforming creation that a naive parser refuses.
  ['a conforming creation in a subshell', () => bash(`(cd /repo && git worktree add ${OK})`)],
  ['the rtk prefix AGENTS.md mandates', () => bash(`rtk git worktree add ${OK}`)],
  ['an env-var prefix', () => bash(`RTK_DISABLED=1 git worktree add ${OK}`)],
  ['a trailing slash on the path', () => bash(`git worktree add ${OK}/`)],
  ['-B instead of -b', () => bash(`git worktree add -B argo/#901-naming ${WT}/ticket-901-naming`)],
  ['a glued -b value', () => bash(`git worktree add -bargo/#901-naming ${WT}/ticket-901-naming`)],
  // An unexpanded path is one this hook cannot resolve. Guessing would deny a name that may
  // well be right — and a computed absolute path is how a sub-agent is dispatched.
  [
    'a path built from a shell variable',
    () => bash('WT=x; git worktree add $WT/ticket-901-naming'),
  ],
  // A creation is a segment that RUNS git. Eight tracked files quote the phrase, this one
  // included; blocking a mention denies any session searching or rewriting the worktree docs.
  ['grep for the phrase', () => bash('grep -rn "git worktree add" docs/')],
  ['echoing the phrase', () => bash('echo "run: git worktree add .claude/worktrees/foo"')],
  ['the phrase in a heredoc body', () => bash('cat <<EOF\ngit worktree add somewhere\nEOF')],
  ['a tool call with no command', () => decide({ toolName: 'Bash', toolInput: {}, isAgent: true })],
  [
    'the human workflow (no agent marker)',
    () => decide({ toolName: 'Bash', toolInput: { command: `git worktree add ${WT}/nope` } }),
  ],
]

for (const [name, run] of PERMITTED) check(`allows ${name}`, () => assert.equal(run().block, false))

// The refusal has to name the right shape, or every future session pays a lookup.
check('the refusal spells out both names and cites the doc', () => {
  const { reason } = bash(`git worktree add ${WT}/parallel-workitem-edges`)
  assert.match(reason, /ticket-<N>-<slug>/)
  assert.match(reason, /argo\/#<N>-<slug>/)
  assert.match(reason, /ticket-<slug>/) // the numberless shape, not a dead end
  assert.match(reason, /docs\/agents\/worktrees\.md/)
})

// End to end: the wired script denies, and is silent otherwise. Codex sends camelCase toolInput
// and has no CLAUDECODE, so the projection injects ARGO_HOOK_AGENT instead.
const run = (payload, env) =>
  execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    env: { ...process.env, CLAUDECODE: '', ARGO_HOOK_AGENT: '', ...env },
    encoding: 'utf8',
  })
const denied = { command: `git worktree add ${WT}/nope` }

check('script emits deny JSON for an off-convention creation', () => {
  const out = run({ tool_name: 'Bash', tool_input: denied, cwd: '/repo' }, { CLAUDECODE: '1' })
  const { permissionDecision, permissionDecisionReason } = JSON.parse(out).hookSpecificOutput
  assert.equal(permissionDecision, 'deny')
  assert.match(permissionDecisionReason, /ticket-<N>-<slug>/)
})
check('script blocks via ARGO_HOOK_AGENT on a camelCase payload', () => {
  const out = run({ toolName: 'Bash', toolInput: denied, cwd: '/repo' }, { ARGO_HOOK_AGENT: '1' })
  assert.equal(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny')
})
check('script stays silent for a conforming creation', () => {
  const input = {
    tool_name: 'Bash',
    tool_input: { command: `git worktree add ${OK}` },
    cwd: '/repo',
  }
  assert.equal(run(input, { CLAUDECODE: '1' }).trim(), '')
})
check('script stays silent for the human (no agent marker)', () => {
  assert.equal(run({ tool_name: 'Bash', tool_input: denied, cwd: '/repo' }).trim(), '')
})

report('worktree-name-guard')
