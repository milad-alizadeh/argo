#!/usr/bin/env node
import assert from 'node:assert/strict'
// Enforcing test for the guardrail hooks' shared plumbing, run via `bun run test:hooks`.
// runGuard now stands under three hooks, on the two highest-frequency tools there are. Its
// contract is that it never wedges the session, so every case below is a way of failing that
// still has to end in a silent, zero-exit allow.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { check, report } from './check-harness.mjs'

// runGuard exits the process, so each case runs as its own script rather than in-process.
const DIR = mkdtempSync(path.join(tmpdir(), 'hook-io-'))
const run = (body, input) => {
  const file = path.join(DIR, `${Math.random().toString(36).slice(2)}.mjs`)
  writeFileSync(
    file,
    `import { runGuard } from ${JSON.stringify(path.resolve('scripts/hook-io.mjs'))}\n${body}\n`,
  )
  return execFileSync(process.execPath, [file], { input, encoding: 'utf8' })
}

const ALLOW = 'await runGuard(() => ({ block: false }))'
const DENY = "await runGuard(() => ({ block: true, reason: 'because' }))"
const THROWS = "await runGuard(() => { throw new Error('guard bug') })"

check('a deny becomes a PreToolUse deny with its reason', () => {
  const parsed = JSON.parse(run(DENY, '{}'))
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PreToolUse')
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny')
  assert.equal(parsed.hookSpecificOutput.permissionDecisionReason, 'because')
})

check('an allow says nothing at all', () => assert.equal(run(ALLOW, '{}').trim(), ''))

// The three ways it can go wrong. A hook that exits non-zero or writes garbage on any of these
// interrupts every Edit, Write and Bash call in the session.
check('malformed JSON fails open', () => assert.equal(run(DENY, 'not json {{').trim(), ''))
// Empty stdin is an empty payload, not a fault: a guard reading no file path allows anyway.
check('empty stdin still reaches decide()', () =>
  assert.equal(JSON.parse(run(DENY, '')).hookSpecificOutput.permissionDecision, 'deny'),
)
check('a decide() that throws fails open', () => assert.equal(run(THROWS, '{}').trim(), ''))

check('the payload reaches decide() intact', () => {
  const out = run(
    'await runGuard((p) => ({ block: true, reason: p.tool_input.file_path }))',
    JSON.stringify({ tool_input: { file_path: 'apps/x.swift' } }),
  )
  assert.equal(JSON.parse(out).hookSpecificOutput.permissionDecisionReason, 'apps/x.swift')
})

// underAgent() reads the marker the projection guarantees: CLAUDECODE natively, or the
// ARGO_HOOK_AGENT it injects for a markerless harness.
const marker = (env) =>
  execFileSync(
    process.execPath,
    [
      '-e',
      `import(${JSON.stringify(path.resolve('scripts/hook-io.mjs'))}).then((m) => process.stdout.write(String(m.underAgent())))`,
    ],
    { env: { ...process.env, CLAUDECODE: '', ARGO_HOOK_AGENT: '', ...env }, encoding: 'utf8' },
  )

check('underAgent is true under CLAUDECODE', () =>
  assert.equal(marker({ CLAUDECODE: '1' }), 'true'),
)
check('underAgent is true under ARGO_HOOK_AGENT', () =>
  assert.equal(marker({ ARGO_HOOK_AGENT: '1' }), 'true'),
)
check('underAgent is false for the human', () => assert.equal(marker({}), 'false'))

report('hook-io')
