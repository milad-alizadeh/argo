#!/usr/bin/env node
// The shared fixture for the two `build-lock.sh` suites, extracted when the second one was
// written — `build-lock.test.mjs` holds the mutual exclusion itself, and
// `build-lock-entrypoints.test.mjs` holds which callers take a slot and how a slot passes down a
// process tree. Same split, and the same reason, as `swift-tooling.harness.mjs` (#998): one file
// past the line ceiling is two files, never a raised ceiling.
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
export function withLock(dir, body, { slots = 1, env = {}, timeout } = {}) {
  const script = `
set -e
. "${LOCK}"
${body}
`
  return execFileSync('sh', ['-c', script], {
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
