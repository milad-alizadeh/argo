#!/usr/bin/env node
import assert from 'node:assert/strict'
// Test for the cross-CLI hook projection, run via `bun run test:hooks`.
// Guards the two harness differences the projection must absorb: the ARGO_HOOK_AGENT
// injection for markerless harnesses (Codex) and the shared PascalCase event shape.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeHooks, project } from '../packages/argo-skills/bin/hooks-sync.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const descriptor = JSON.parse(readFileSync(path.join(HERE, '..', 'hooks.json'), 'utf8'))

let failures = 0
function check(name, fn) {
  try {
    fn()
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures += 1
    console.error(`  FAIL ${name}\n       ${err.message}`)
  }
}

const guardCmd = (block) =>
  block.PreToolUse.find((g) => g.matcher === 'Edit|Write').hooks[0].command

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

// Non-agentGated commands are never prefixed, on any harness.
check('graphify command is byte-identical across harnesses', () => {
  const c = project(descriptor, 'claude-code').hooksBlock.PreToolUse[0].hooks[0].command
  const x = project(descriptor, 'codex').hooksBlock.PreToolUse[0].hooks[0].command
  assert.equal(c, x)
  assert.equal(c, 'graphify hook-guard search')
})

// Shape: neutral events map to Codex-compatible PascalCase keys; groups preserve
// matcher / timeout / statusMessage; session-end carries no matcher.
check('projects PascalCase event keys with the right group shapes', () => {
  const b = project(descriptor, 'codex').hooksBlock
  assert.equal(b.PreToolUse.length, 3)
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
    matcher: 'Bash',
    hooks: [{ type: 'command', command: 'graphify hook-guard search' }],
  }
  const ours = project(descriptor, 'claude-code').hooksBlock
  const merged = mergeHooks({ PreToolUse: [foreign, ourOld] }, ours)
  assert.ok(
    merged.PreToolUse.some((g) => g.hooks[0].command === 'my-own-linter'),
    'foreign kept',
  )
  const graphifyGroups = merged.PreToolUse.filter((g) =>
    g.hooks[0].command.includes('hook-guard search'),
  )
  assert.equal(graphifyGroups.length, 1, 'ours replaced, not duplicated')
})

if (failures > 0) {
  console.error(`\nhooks-sync: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nhooks-sync: all checks passed')
