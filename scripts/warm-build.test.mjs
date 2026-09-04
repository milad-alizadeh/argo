#!/usr/bin/env node
// Tests for `scripts/warm-build.sh`, run via `bun run test:hooks`. Its own file rather than a
// third section of `swift-tooling.test.mjs`, which is already at the 150-line ceiling — the same
// reason `swift-build.test.mjs` sits beside it (#998). All three share the one stub harness.
//
// The contract is unusual enough to be worth stating: every other Swift entrypoint is judged on
// what it RAN, and this one on the fact that it did not wait. A warm that blocked would be the
// cold build again, moved one line up the session and not off the critical path at all (#1358).
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { BARE, run, STRICT, scratch } from './swift-tooling.harness.mjs'

const WARM = 'scripts/warm-build.sh'
// Longer than any plausible startup, so "returned early" cannot be a fast machine getting lucky.
const SLOW_SECONDS = 5

// `uname` says Darwin so these run on a Linux CI box too, and `swift` sleeps far longer than the
// assertion allows. It writes nothing: nothing reads a warm's output, which is the whole
// difference between this entrypoint and the ones that are judged on a report.
const WARM_BIN = path.join(scratch, 'warm-bin')
mkdirSync(WARM_BIN, { recursive: true })
for (const [tool, body] of [
  ['uname', 'printf Darwin\n'],
  ['swift', `sleep ${SLOW_SECONDS}\n`],
]) {
  writeFileSync(path.join(WARM_BIN, tool), `#!/bin/sh\n${body}`)
  chmodSync(path.join(WARM_BIN, tool), 0o755)
}
const WARMING = { pathValue: `${WARM_BIN}:/usr/bin:/bin` }

check('warm-build.sh skips where Swift cannot run', () => {
  const result = run(WARM, BARE)
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /skipping/)
})

check('warm-build.sh fails there instead under ARGO_REQUIRE_SWIFT_TOOLS', () => {
  // The macOS CI job's rule, held here as everywhere else: a warm that quietly did nothing there
  // would leave every later timing unexplained.
  const result = run(WARM, { ...BARE, env: STRICT })
  assert.equal(result.status, 1, result.output)
  assert.doesNotMatch(result.output, /skipping/)
})

check('warm-build.sh returns before the build it started has finished', () => {
  const log = path.join(scratch, 'warm.log')
  const started = Date.now()
  const result = run(WARM, { ...WARMING, env: { ARGO_WARM_LOG: log } })
  const waited = Date.now() - started
  assert.equal(result.status, 0, result.output)
  // Well inside the stub's sleep: a script that waited takes at least five packages' worth of it.
  assert.ok(waited < SLOW_SECONDS * 1000, `waited ${waited}ms for a build it was to detach from`)
})

check('warm-build.sh says where the build went', () => {
  // A background job nobody can read is a background job nobody can tell from one that never
  // started, so the log path is part of what it returns rather than something to go looking for.
  const log = path.join(scratch, 'named.log')
  const result = run(WARM, { ...WARMING, env: { ARGO_WARM_LOG: log } })
  assert.ok(result.output.includes(log), result.output)
  // And how to know it has finished, since the exit code cannot say so.
  assert.match(result.output, /ends in 'warm: done'/)
})

rmSync(scratch, { recursive: true, force: true })

report('warm-build')
