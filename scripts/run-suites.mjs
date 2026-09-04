#!/usr/bin/env node
// The runner behind `bun run test:hooks`: every `scripts/*.test.mjs`, in parallel.
//
// It replaced a 24-link `&&` chain, which cost about 105 seconds at 58% CPU. Almost none of that
// was work — the suites spawn `node`, `sh` and the VCS by the hundred and then wait on them, so a
// chain runs one suite's idle where another suite's could have run. Nothing here made a suite
// faster; the pool just stops them queueing behind each other.
//
// Discovery is the directory, not a list. Under the chain a new suite only ran once somebody
// remembered to append it, and a suite nobody appended is indistinguishable from one that passes.
import { execFile } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url))
// Suites resolve their fixtures against the working directory (`path.resolve('scripts/…')`), so
// the root is fixed from this file's own location rather than inherited from the caller.
const ROOT = path.resolve(SCRIPTS, '..')

const suites = readdirSync(SCRIPTS)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()

// A run that found no suites is the failure `check-harness.mjs` refuses for a suite that ran no
// checks: silence that reads as success. A rename of this directory is exactly how it would happen.
if (suites.length === 0) {
  console.error('test:hooks: found no scripts/*.test.mjs at all — nothing ran')
  // `exit()` here and `exitCode` at the end, deliberately: nothing has run yet, so there is one
  // line to flush and the rest of this file must not go on to report 0 suites as 0 failures.
  process.exit(1)
}

const run = (file) =>
  new Promise((resolve) => {
    const started = Date.now()
    execFile(
      process.execPath,
      [path.join(SCRIPTS, file)],
      // The suites shell out a lot, and a few print a great deal before they fail.
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) =>
        resolve({
          file,
          stdout,
          stderr,
          code: err ? (err.code ?? 1) : 0,
          ms: Date.now() - started,
        }),
    )
  })

// One `ok` line per check is 348 lines nobody reads on a green run, so a passing suite is one
// line and a failing one is everything it said. `report()` writes the FAIL lines to stderr and
// the ok lines to stdout, and both are kept: which case broke is the only thing worth having.
const summarise = ({ file, stdout, stderr, code, ms }) => {
  const passed = stdout.match(/^(.+): all (\d+) checks passed$/m)
  const seconds = `${(ms / 1000).toFixed(1)}s`
  if (code === 0 && passed) {
    console.log(`  ok   ${passed[1]} — ${passed[2]} checks, ${seconds}`)
    return { ok: true, checks: Number(passed[2]) }
  }
  // Exit 0 with no passing line is the third way a suite can lie: it returned before `report()`,
  // so nothing counted its checks and nothing failed either.
  const why = code === 0 ? 'exited 0 without reporting its checks' : `exited ${code}`
  console.error(`\n  FAIL ${file} — ${why}, ${seconds}`)
  for (const stream of [stdout, stderr]) if (stream.trim()) console.error(stream.trimEnd())
  return { ok: false, checks: 0 }
}

// A fixed pool rather than one process per suite: the heavy suites each spawn a shell per case,
// so the whole directory at once oversubscribes the machine and reads slower than it is.
const queue = [...suites]
const results = []
const worker = async () => {
  for (let file = queue.shift(); file; file = queue.shift()) results.push(await run(file))
}
await Promise.all(Array.from({ length: Math.min(availableParallelism(), suites.length) }, worker))

// Reported in the directory's order, not the order they happened to finish, so two runs of the
// same tree print the same thing.
const byName = new Map(results.map((r) => [r.file, r]))
const verdicts = suites.map((file) => summarise(byName.get(file)))

const failed = verdicts.filter((v) => !v.ok).length
const checks = verdicts.reduce((total, v) => total + v.checks, 0)
if (failed) {
  // `exitCode` rather than `exit()`: turbo and CI capture this through a pipe, and `exit()` can
  // cut a still-draining stderr off mid-line — losing exactly the failing suite's own output,
  // which is the only reason the run printed anything at all.
  console.error(`\ntest:hooks: ${failed} of ${suites.length} suite(s) failed`)
  process.exitCode = 1
}
const plural = suites.length === 1 ? 'suite' : 'suites'
console.log(`\ntest:hooks: ${suites.length} ${plural} clean, ${checks} checks passed`)
