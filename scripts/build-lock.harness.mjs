#!/usr/bin/env node
// The shared fixture for the three `build-lock.sh` suites, split by subject as each went past
// the line ceiling: `build-lock.test.mjs` is the mutual exclusion itself,
// `build-lock-entrypoints.test.mjs` is which callers take a slot, and
// `build-lock-inheritance.test.mjs` is how one slot passes down a process tree. Same split, and
// the same reason, as `swift-tooling.harness.mjs` (#998): one file past the ceiling is two
// files, never a raised ceiling.
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const LOCK = path.join(ROOT, 'scripts/build-lock.sh')

export function workspace() {
  return mkdtempSync(path.join(tmpdir(), 'argo-build-lock-'))
}

// Run `body` inside a shell that has sourced the lock, with the lock root and slot count set.
// Returns the process's stdout.
//
// `timeout` matters for any case whose REGRESSION is a wait rather than a wrong answer.
// `build_lock_acquire` blocks until a slot frees, by design and for ever, so a test that asserts
// something does not block would hang the suite instead of failing it — and a suite that hangs is
// one somebody kills, not one somebody reads.
// `shell` runs the same body under a named shell. macOS `/bin/sh` is bash in POSIX mode and
// Linux's is dash, and they do NOT agree about `trap` — bash reports the caller's handlers inside
// a command substitution, dash reports nothing there (#1431). So a lock case that only ever ran
// under one of them proved the mechanism on one half of the machines it ships to.
export function withLock(dir, body, { slots = 1, env = {}, timeout, shell = 'sh' } = {}) {
  const script = `
set -e
. "${LOCK}"
${body}
`
  return execFileSync(shell, ['-c', script], {
    encoding: 'utf8',
    ...(timeout ? { timeout } : {}),
    env: {
      ...process.env,
      ARGO_BUILD_LOCK_ROOT: path.join(dir, 'lock'),
      ARGO_BUILD_LOCK_SLOTS: String(slots),
      ...env,
    },
  })
}
