#!/usr/bin/env node
// Enforcing test for the suite runner itself, run via `bun run test:hooks` — by the runner, on
// itself. It is the one suite whose subject is the thing running it, so nothing here touches the
// real `scripts/`: each case copies `run-suites.mjs` into a temp directory of fixture suites and
// runs THAT copy. The runner takes no arguments and fixes its root from its own file location,
// which is what makes the copy a complete substitute.
//
// The cases are all one shape: a runner that reports green when a suite did not pass is the
// failure mode worth having a test for, because a pool of 24 subprocesses hides a lost exit code
// far better than a chain of `&&` ever did.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const RUNNER = fileURLToPath(new URL('run-suites.mjs', import.meta.url))

// A suite as the harness writes them: N passing checks, then the `report()` line the runner reads.
const passing = (name, checks) => `console.log('${name}: all ${checks} checks passed')\n`

// Builds a temp tree, drops the named suites in it, and runs the copied runner over it. Returns
// the exit code and both streams rather than throwing, because every case here asserts on one.
const runOver = (suites) => {
  const root = mkdtempSync(path.join(tmpdir(), 'run-suites-'))
  const scripts = path.join(root, 'scripts')
  mkdirSync(scripts)
  copyFileSync(RUNNER, path.join(scripts, 'run-suites.mjs'))
  // check-harness.mjs is imported by nothing here — the fixtures print the line directly — but a
  // suite that crashes on a missing import would pass the failure cases for the wrong reason.
  copyFileSync(
    path.join(path.dirname(RUNNER), 'check-harness.mjs'),
    path.join(scripts, 'check-harness.mjs'),
  )
  for (const [name, body] of Object.entries(suites)) writeFileSync(path.join(scripts, name), body)
  try {
    const stdout = execFileSync(process.execPath, [path.join(scripts, 'run-suites.mjs')], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' }
  }
}

check('a directory of passing suites is clean, and the checks are totalled', () => {
  const { code, stdout } = runOver({
    'a.test.mjs': passing('alpha', 3),
    'b.test.mjs': passing('beta', 4),
  })
  assert.equal(code, 0)
  assert.match(stdout, /2 suites clean, 7 checks passed/)
})

check('every suite in the directory runs, named or not', () => {
  // The chain this replaced ran the suites somebody had appended to it. Discovery is the point:
  // a file nobody mentioned anywhere still has to run.
  const { stdout } = runOver({
    'never-mentioned.test.mjs': passing('unlisted', 1),
    'b.test.mjs': passing('beta', 1),
  })
  assert.match(stdout, /ok {3}unlisted/)
})

check('a non-.test.mjs neighbour is not run', () => {
  const { code, stdout } = runOver({
    'a.test.mjs': passing('alpha', 1),
    // A helper, not a suite. Running it would fail the whole gate on a module with no side effects.
    'fixture.mjs': 'process.exit(3)\n',
  })
  assert.equal(code, 0)
  assert.match(stdout, /1 suite clean/)
})

check('a failing suite fails the run', () => {
  const { code, stderr } = runOver({
    'a.test.mjs': passing('alpha', 1),
    'b.test.mjs': "console.error('  FAIL the beta case')\nprocess.exit(1)\n",
  })
  assert.equal(code, 1)
  assert.match(stderr, /1 of 2 suite\(s\) failed/)
})

check('a failing suite prints everything it said', () => {
  // The pool buffers, so a case that says which half it lost has to survive the buffering. This
  // is the whole reason a failing suite is not summarised into one line like a passing one.
  const { stderr } = runOver({
    'b.test.mjs':
      "console.log('  ok   the half that held')\nconsole.error('  FAIL the half that did not\\n       expected 3, got 4')\nprocess.exit(1)\n",
  })
  assert.match(stderr, /the half that held/)
  assert.match(stderr, /expected 3, got 4/)
})

check('a suite that exits 0 without reporting is a failure', () => {
  // The third way a suite lies: it returned before `report()`, so nothing counted its checks and
  // nothing failed either. Under `&&` this passed straight through.
  const { code, stderr } = runOver({ 'a.test.mjs': "console.log('  ok   something')\n" })
  assert.equal(code, 1)
  assert.match(stderr, /exited 0 without reporting its checks/)
})

check('a suite that prints nothing at all is a failure', () => {
  const { code, stderr } = runOver({ 'a.test.mjs': '\n' })
  assert.equal(code, 1)
  assert.match(stderr, /exited 0 without reporting its checks/)
})

check('a crashing suite is a failure, with its stack', () => {
  const { code, stderr } = runOver({ 'a.test.mjs': "throw new Error('suite bug')\n" })
  assert.equal(code, 1)
  assert.match(stderr, /suite bug/)
})

check('a directory with no suites at all is a failure', () => {
  const { code, stderr } = runOver({})
  assert.equal(code, 1)
  assert.match(stderr, /found no scripts\/\*\.test\.mjs at all/)
})

check('the report is in directory order, not the order they finished', () => {
  // `b` sleeps so it finishes last; it still prints first, because two runs of one tree that
  // print different things are two runs nobody can diff.
  const { stdout } = runOver({
    'a.test.mjs': `await new Promise((r) => setTimeout(r, 400))\n${passing('zulu', 1)}`,
    'b.test.mjs': passing('alpha', 1),
  })
  assert.ok(stdout.indexOf('zulu') < stdout.indexOf('alpha'), stdout)
})

check('suites run from the root, not from scripts/', () => {
  // Every real suite resolves its fixtures with `path.resolve('scripts/…')`, so the working
  // directory is part of the contract and not the caller's business.
  const { code, stdout } = runOver({
    'a.test.mjs':
      "if (!process.cwd().endsWith('scripts')) console.log('cwd: all 1 checks passed')\n",
  })
  assert.equal(code, 0)
  assert.match(stdout, /ok {3}cwd/)
})

check('one bad suite does not hide the good ones', () => {
  const { stdout, stderr } = runOver({
    'a.test.mjs': passing('alpha', 2),
    'b.test.mjs': 'process.exit(1)\n',
    'c.test.mjs': passing('gamma', 2),
  })
  assert.match(stdout, /ok {3}alpha/)
  assert.match(stdout, /ok {3}gamma/)
  assert.match(stderr, /1 of 3 suite\(s\) failed/)
})

report('run-suites')
