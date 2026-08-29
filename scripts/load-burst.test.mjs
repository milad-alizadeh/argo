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

// The whole check runs in one shell, and asserts the PROPERTY rather than a duration: the
// workers are still alive the moment their parent is gone, and they stop by themselves
// afterwards. Nothing here measures elapsed seconds, because a shared CI runner is exactly
// the loaded machine this ticket is about — a wall-clock bound would make this the flake it
// was written to prevent.
//
// Workers are held by PID, taken before the kill. `pgrep -f` on the script path cannot be
// used: this shell's own command line contains that path, so on Linux it matches ITSELF and
// the poll never ends. That is what reddened CI (#937) — a self-match, not a timing bound.
const OUTLIVES_PARENT = `
  sh '${SCRIPT}' 3 8 >/dev/null 2>&1 &
  parent=$!
  sleep 2
  workers=$(pgrep -P "$parent" || true)
  [ -n "$workers" ] || exit 2
  kill -9 "$parent" 2>/dev/null
  sleep 1
  # THE GUARANTEE: the parent is gone and these are not. Were the deadline the parent's,
  # they would have died with it, and this is where that shows.
  for w in $workers; do kill -0 "$w" 2>/dev/null || exit 3; done
  # And they stop on their own. The ceiling is a hang guard, not a claim about when.
  turn=0
  while [ "$turn" -lt 60 ]; do
    alive=0
    for w in $workers; do if kill -0 "$w" 2>/dev/null; then alive=1; fi; done
    if [ "$alive" -eq 0 ]; then exit 0; fi
    sleep 1
    turn=$((turn + 1))
  done
  # Reap them before reporting. A check about leaked spinners must not leak spinners when
  # it fails, which is the whole shape of the incident behind #918.
  kill -9 $workers 2>/dev/null
  exit 4
`

check('a worker outlives its parent and still stops on its own deadline', () => {
  const burst = spawnSync('/bin/sh', ['-c', OUTLIVES_PARENT], { encoding: 'utf8', timeout: 120000 })
  const said = {
    2: 'the burst started no workers to observe',
    3: "the workers died WITH their parent — the deadline is the parent's, not theirs",
    4: 'the workers never stopped on their own',
    null: 'the shell was killed or timed out',
  }
  assert.equal(burst.status, 0, said[burst.status] ?? burst.stderr)
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
