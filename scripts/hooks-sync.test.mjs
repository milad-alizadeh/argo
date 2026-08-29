#!/usr/bin/env node
import assert from 'node:assert/strict'
// Test for the cross-CLI hook projection, run via `bun run test:hooks`.
// Guards the two harness differences the projection must absorb: the ARGO_HOOK_AGENT
// injection for markerless harnesses (Codex) and the shared PascalCase event shape.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeHooks, project } from '../packages/argo-skills/bin/hooks-sync.mjs'
import { check, report } from './check-harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const descriptor = JSON.parse(readFileSync(path.join(HERE, '..', 'hooks.json'), 'utf8'))

const guardCmd = (block) =>
  block.PreToolUse.find((g) => g.matcher === 'Edit|Write').hooks[0].command

// A consumer installs the hooks with `scaffold.mjs --hooks`, which copies HOOK_ASSETS and then
// projects hooks.json. The two are separate lists, so adding a hook whose script is not an asset
// ships a projected command pointing at a file that was never copied — it throws on first use, in
// the consumer's repo rather than here. Derive the requirement instead of trusting the lockstep
// comment: every repo script a command names must be an asset.
//
// Read as TEXT, never imported: scaffold.mjs is a CLI whose body runs at module scope, so
// importing it to read one constant installs 59 skills as a side effect of running the tests.
const assets = readFileSync(path.join(HERE, '..', 'packages/argo-skills/bin/scaffold.mjs'), 'utf8')
check('every script hooks.json invokes is copied by scaffold', () => {
  const block = assets.match(/const HOOK_ASSETS = \[(.*?)\]/s)
  assert.ok(block, 'HOOK_ASSETS not found in scaffold.mjs — this check has gone blind')
  const copied = [...block[1].matchAll(/'([^']+)'/g)].map(([, rel]) => rel)

  const named = new Set()
  for (const hook of descriptor.hooks) {
    for (const [, rel] of hook.command.matchAll(/\/(scripts\/[\w.-]+\.(?:mjs|sh))/g)) named.add(rel)
  }
  assert.ok(named.size > 0, 'no scripts/ commands found — this check has gone blind')

  const missing = [...named].filter((rel) => !copied.includes(rel))
  assert.deepEqual(missing, [], `hooks.json invokes scripts scaffold never copies: ${missing}`)
})

check('claude-code: known, targets .claude/settings.json', () => {
  const r = project(descriptor, 'claude-code')
  assert.equal(r.known, true)
  assert.equal(r.target, '.claude/settings.json')
})

check('codex: known, targets .codex/hooks.json', () => {
  const r = project(descriptor, 'codex')
  assert.equal(r.known, true)
  assert.equal(r.target, '.codex/hooks.json')
})

check('unknown agent (cursor): not known, no crash', () => {
  const r = project(descriptor, 'cursor')
  assert.equal(r.known, false)
  assert.deepEqual(r.warnings, [])
})

// The agent-marker difference — the whole reason a naive copy of the block breaks
// under Codex.
check('claude-code does NOT inject ARGO_HOOK_AGENT (CLAUDECODE is native)', () => {
  assert.doesNotMatch(guardCmd(project(descriptor, 'claude-code').hooksBlock), /ARGO_HOOK_AGENT/)
})
check('codex DOES inject ARGO_HOOK_AGENT (no native marker)', () => {
  assert.match(guardCmd(project(descriptor, 'codex').hooksBlock), /^ARGO_HOOK_AGENT=1 /)
})

// Non-agentGated commands are never prefixed, on any harness. The reaper is the only one
// left, so it is the sole subject of this property.
check('non-agentGated command is byte-identical across harnesses', () => {
  const c = project(descriptor, 'claude-code').hooksBlock.SessionEnd[0].hooks[0].command
  const x = project(descriptor, 'codex').hooksBlock.SessionEnd[0].hooks[0].command
  assert.equal(c, x)
  assert.doesNotMatch(c, /ARGO_HOOK_AGENT/)
  assert.match(c, /worktree-gc\.sh/)
})

// Shape: neutral events map to Codex-compatible PascalCase keys; groups preserve
// matcher / timeout / statusMessage; session-end carries no matcher.
check('projects PascalCase event keys with the right group shapes', () => {
  const b = project(descriptor, 'codex').hooksBlock
  assert.equal(b.PreToolUse.length, 2)
  // Matchers, not just the count: widening one is what a token-cost regression looks like,
  // and every count-based assertion here stays green through it.
  assert.deepEqual(
    b.PreToolUse.map((g) => g.matcher),
    ['Edit|Write', 'Write'],
  )
  assert.equal(b.SessionEnd.length, 1)
  const end = b.SessionEnd[0]
  assert.equal(end.matcher, undefined)
  assert.equal(end.hooks[0].timeout, 60)
  assert.equal(end.hooks[0].statusMessage, 'Reaping landed worktrees')
})

// Unknown neutral event is reported, not silently dropped.
check('unknown event -> warning, skipped', () => {
  const r = project({ hooks: [{ event: 'post-compact', command: 'x' }] }, 'codex')
  assert.equal(r.hooksBlock.PostCompact, undefined)
  assert.match(r.warnings.join('\n'), /post-compact/)
})

// Merge preserves a consumer's own hooks and replaces only ours — idempotently.
check('mergeHooks keeps foreign groups, replaces managed ones', () => {
  const foreign = { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-linter' }] }
  const ourOld = {
    matcher: 'Edit|Write',
    hooks: [{ type: 'command', command: 'node /old/path/scripts/worktree-guard.mjs' }],
  }
  const ours = project(descriptor, 'claude-code').hooksBlock
  const merged = mergeHooks({ PreToolUse: [foreign, ourOld] }, ours)
  assert.ok(
    merged.PreToolUse.some((g) => g.hooks[0].command === 'my-own-linter'),
    'foreign kept',
  )
  const guardGroups = merged.PreToolUse.filter((g) =>
    g.hooks[0].command.includes('worktree-guard.mjs'),
  )
  assert.equal(guardGroups.length, 1, 'ours replaced, not duplicated')
})

// The assertions above read `project()`, which is pure and cannot see a merge fault. A hook
// whose script is missing from MANAGED_MARKERS reads as the consumer's own, so mergeHooks
// keeps it AND appends the new copy — the projection stays correct while the written file
// grows a duplicate per sync. Re-merging our own output is the only place that shows up.
check('re-syncing our own output is idempotent (every hook is recognised as ours)', () => {
  const ours = project(descriptor, 'claude-code').hooksBlock
  const once = mergeHooks({}, ours)
  const twice = mergeHooks(once, ours)
  assert.deepEqual(
    twice.PreToolUse.map((g) => g.matcher),
    once.PreToolUse.map((g) => g.matcher),
    'a second sync duplicated a group — its script is missing from MANAGED_MARKERS',
  )
  assert.equal(twice.SessionEnd.length, once.SessionEnd.length)
})

// Derive the requirement rather than trusting the list: every script hooks.json invokes must
// be a managed marker, or the check above only catches the ones somebody remembered.
check('every script hooks.json invokes is a managed marker', () => {
  const source = readFileSync(
    path.join(HERE, '..', 'packages/argo-skills/bin/hooks-sync.mjs'),
    'utf8',
  )
  const block = source.match(/const MANAGED_MARKERS = \[(.*?)\]/s)
  assert.ok(block, 'MANAGED_MARKERS not found — this check has gone blind')
  const markers = [...block[1].matchAll(/'([^']+)'/g)].map(([, m]) => m)

  for (const hook of descriptor.hooks) {
    assert.ok(
      markers.some((m) => hook.command.includes(m)),
      `no MANAGED_MARKERS entry matches "${hook.command}" — it would duplicate on re-sync`,
    )
  }
})

report('hooks-sync')
