#!/usr/bin/env node
// Tests for `scripts/warm-build.sh`, run via `bun run test:hooks`. Its own file rather than a
// third section of `swift-tooling.test.mjs`, which is already at the 150-line ceiling — the same
// reason `swift-build.test.mjs` sits beside it (#998). All three share the one stub harness.
//
// The contract is unusual enough to be worth stating: every other Swift entrypoint is judged on
// what it RAN, and this one on the fact that it did not wait. A warm that blocked would be the
// cold build again, moved one line up the session and not off the critical path at all (#1358).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'
import { BARE, run, STRICT, scratch } from './swift-tooling.harness.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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
// The lock root is scoped to the scratch, not left to default. Without this the warm below takes
// a slot under the MACHINE's `$TMPDIR/argo-build-lock` — the one real builds queue on — and a
// suite that leaves a slot behind there throttles every lane on the box until someone finds it.
const WARM_LOCK = path.join(scratch, 'lock')
const LOCK_ENV = { ARGO_BUILD_LOCK_ROOT: WARM_LOCK, ARGO_BUILD_LOCK_SLOTS: '1' }
const WARMING = { pathValue: `${WARM_BIN}:/usr/bin:/bin`, env: LOCK_ENV }

const sleep = (seconds) => execFileSync('sh', ['-c', `sleep ${seconds}`])

// Poll rather than sleep a fixed span: the answer is usually there in the first tick, and a
// fixed wait long enough for the slowest machine is a fixed wait paid on every machine.
function waitFor(predicate, seconds, what) {
  for (let i = 0; i < seconds * 5; i++) {
    if (predicate()) return true
    sleep(0.2)
  }
  assert.fail(`${what} did not happen within ${seconds}s`)
}

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
  const result = run(WARM, { ...WARMING, env: { ...LOCK_ENV, ARGO_WARM_LOG: log } })
  const waited = Date.now() - started
  assert.equal(result.status, 0, result.output)
  // Well inside the stub's sleep: a script that waited takes at least five packages' worth of it.
  assert.ok(waited < SLOW_SECONDS * 1000, `waited ${waited}ms for a build it was to detach from`)
})

check('warm-build.sh says where the build went', () => {
  // A background job nobody can read is a background job nobody can tell from one that never
  // started, so the log path is part of what it returns rather than something to go looking for.
  const log = path.join(scratch, 'named.log')
  const result = run(WARM, { ...WARMING, env: { ...LOCK_ENV, ARGO_WARM_LOG: log } })
  assert.ok(result.output.includes(log), result.output)
  // And how to know it has finished, since the exit code cannot say so.
  assert.match(result.output, /ends in 'warm: done'/)
})

// The warm holds a real, LIVE slot, and gives it back.
//
// Both halves are regressions that a structural check cannot see, because both come from the
// shape of the block the acquire sits in rather than from whether it is called. Inside a
// backgrounded `{ … } &` group — which is what this script used — `$$` is still the parent's
// pid and an EXIT trap never runs, both measured on this repo's `/bin/sh`. So the slot was
// recorded under a pid that exited a moment later, the next lane to look reclaimed it as stale
// and built on top of the warm, and nothing ever released it. Re-entering the script as a real
// child process is what fixes it, and this is what says so.
check('warm-build.sh holds a live build slot and releases it', () => {
  const log = path.join(scratch, 'slot.log')
  rmSync(WARM_LOCK, { recursive: true, force: true })
  const result = run(WARM, { ...WARMING, env: { ...LOCK_ENV, ARGO_WARM_LOG: log } })
  assert.equal(result.status, 0, result.output)

  const slot = path.join(WARM_LOCK, 'slot-1')
  const pidFile = path.join(slot, 'pid')
  waitFor(() => existsSync(pidFile), 10, 'the warm took a build slot')

  // The pid in the slot must be a process that is still RUNNING. Before the fix it was the
  // parent's, which has already returned to the caller by the time this line runs, so
  // `build-lock.sh` would reclaim the slot from under the build still using it.
  const pid = Number(readFileSync(pidFile, 'utf8').trim())
  assert.ok(Number.isInteger(pid) && pid > 0, `slot pid unreadable: ${pid}`)
  let alive = true
  try {
    process.kill(pid, 0)
  } catch {
    alive = false
  }
  assert.ok(alive, `slot recorded pid ${pid}, which is not running — another lane would reap it`)

  // And it comes back. The stub sleeps per package, so this is the whole warm plus margin.
  waitFor(() => !existsSync(slot), 60, 'the warm released its build slot')
})

// A warm whose tree has been taken away stops instead of spending a slot on nothing (#1450).
//
// This is not hypothetical: two of the thirty-three leaked workers found on one machine named
// `/private/tmp/argo-main-check`, a directory that had already been deleted. Each would have won
// a build slot eventually, taken it from work somebody wanted, and compiled nothing.
check('warm-build.sh stops when its worktree has gone', () => {
  // A COPY of the tree, not the repo: this case deletes the packages out from under a running
  // warm, and the harness's `run` points the real script at the real `apps/macOS`.
  const tree = path.join(scratch, 'gone-tree')
  mkdirSync(path.join(tree, 'scripts'), { recursive: true })
  for (const file of ['warm-build.sh', 'swift-tool-guard.sh', 'build-lock.sh']) {
    writeFileSync(path.join(tree, 'scripts', file), readFileSync(path.join(REPO, 'scripts', file)))
  }
  const packages = path.join(tree, 'apps/macOS/Packages')
  for (const pkg of ['ArgoDesign', 'ArgoEngine', 'ArgoMermaid', 'ArgoAtlas', 'ArgoUI']) {
    mkdirSync(path.join(packages, pkg), { recursive: true })
  }

  const log = path.join(scratch, 'gone.log')
  const lock = path.join(scratch, 'gone-lock')
  rmSync(lock, { recursive: true, force: true })
  execFileSync('sh', [path.join(tree, 'scripts/warm-build.sh')], {
    env: {
      ...process.env,
      PATH: `${WARM_BIN}:/usr/bin:/bin`,
      ARGO_WARM_LOG: log,
      ARGO_BUILD_LOCK_ROOT: lock,
      ARGO_BUILD_LOCK_SLOTS: '1',
    },
  })

  // Take the packages away while the worker is between them — the stub sleeps per package, so
  // there is a window, and it is the same window a `worktree-gc` sweep opens.
  waitFor(() => existsSync(path.join(lock, 'slot-1')), 10, 'the warm took a build slot')
  rmSync(packages, { recursive: true, force: true })

  waitFor(
    () => existsSync(log) && readFileSync(log, 'utf8').includes('is gone'),
    30,
    'the warm noticed its tree had been removed',
  )
  // And it let the slot go on the way out, rather than holding it until something reaped it.
  waitFor(() => !existsSync(path.join(lock, 'slot-1')), 30, 'the warm released its slot')
})

rmSync(scratch, { recursive: true, force: true })

report('warm-build')
