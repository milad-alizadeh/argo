#!/usr/bin/env node
// The one thing `load-burst.sh` promises: a worker stops on its OWN deadline, so one
// orphaned by a killed parent still stops. Diagnosing #918 left twelve unbounded spinners
// saturating a machine for eight hours because a watchdog killed the shell before its
// cleanup ran, and a deadline lifted back into the parent would read as a tidy-up — so the
// invariant is held here rather than in the header alone.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'load-burst.sh')
const sh = (script, args) => spawnSync('/bin/sh', [script, ...args], { encoding: 'utf8' })
// `pgrep -P` only finds live children, so workers are counted through their own command
// line instead — an orphan is reparented and would otherwise vanish from the count.
const workersAlive = () =>
  spawnSync('/bin/sh', ['-c', `pgrep -f '${SCRIPT}' | wc -l`], { encoding: 'utf8' }).stdout.trim()

check('a worker outlives its parent and still stops on its own deadline', () => {
  const started = Date.now()
  const burst = spawnSync(
    '/bin/sh',
    [
      '-c',
      // Start the burst, SIGKILL the parent shell so no trap can run, then wait for the
      // workers to go on their own. SIGKILL is the point: a trap would prove nothing.
      `sh '${SCRIPT}' 3 8 >/dev/null 2>&1 &
       parent=$!
       sleep 2
       kill -9 $parent
       while [ "$(pgrep -f '${SCRIPT}' | wc -l)" -gt 0 ]; do sleep 0.2; done`,
    ],
    { encoding: 'utf8', timeout: 30000 },
  )
  const took = (Date.now() - started) / 1000
  assert.equal(burst.status, 0, burst.stderr)
  // They outlived the kill at 2s and stopped near their own 8s deadline. The floor is 6.9
  // rather than 8 because `date +%s` truncates: a burst starting at T.9 gets a deadline of
  // floor(T) + 8, which is 7.1s of wall clock. Anything below that floor would mean the
  // parent's death is what stopped them, which is the guarantee failing open.
  assert.ok(took >= 6.9, `workers stopped after ${took}s — the kill stopped them, not the clock`)
  assert.ok(took < 14, `workers outlived their 8s deadline by too much (${took}s)`)
  assert.equal(workersAlive(), '0')
})

for (const [name, args, said] of [
  ['transposed arguments', ['600', '8'], /refusing 600 workers/],
  ['too long a burst', ['4', '700'], /refusing 700 seconds/],
  ['no workers', ['0', '10'], /refusing 0 workers/],
]) {
  check(`load-burst.sh refuses ${name}`, () => {
    const result = sh(SCRIPT, args)
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stderr, said)
  })
}

if (failures) {
  console.error(`  load-burst: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('  load-burst: all checks passed')
