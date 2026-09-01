#!/usr/bin/env node
// The two things `load-burst.sh` promises: a worker stops on its OWN deadline, so one
// orphaned by a killed parent still stops, and a reap touches only its own run's workers.
// Diagnosing #918 left twelve unbounded spinners saturating a machine for eight hours
// because a watchdog killed the shell before its cleanup ran, and a deadline lifted back
// into the parent would read as a tidy-up — so both invariants are held here rather than in
// the header alone. The second is #988: a pattern-wide pkill from a third session.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'load-burst.sh')
const sh = (script, args) => spawnSync('/bin/sh', [script, ...args], { encoding: 'utf8' })
// A run whose parent is SIGKILLed leaves its pidfile behind on purpose — that is what
// another session reaps from. Here nobody will, so the token is named and removed by hand.
const RUN_DIR = path.join(process.env.TMPDIR ?? '/tmp', 'argo-load-burst')
const ORPHAN_TOKEN = `outlives-${process.pid}`

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
  sh '${SCRIPT}' 3 8 '${ORPHAN_TOKEN}' >/dev/null 2>&1 &
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
  rmSync(path.join(RUN_DIR, `${ORPHAN_TOKEN}.pids`), { force: true })
  const said = {
    2: 'the burst started no workers to observe',
    3: "the workers died WITH their parent — the deadline is the parent's, not theirs",
    4: 'the workers never stopped on their own',
    null: 'the shell was killed or timed out',
  }
  assert.equal(burst.status, 0, said[burst.status] ?? burst.stderr)
})

// The second promise: cleanup is scoped to one run. A `pkill -f load-burst.sh` from one
// session killed another session's measurement run (#988), so two concurrent bursts are
// started here under their own tokens and only one is reaped — the survivor is the check.
// Workers are held by PID for the same reason as above; matching on the script path would
// see both runs at once, which is precisely the mistake under test.
const REAP_IS_SCOPED = `
  sh '${SCRIPT}' 2 15 "mine-$$" >/dev/null 2>&1 &
  mine_parent=$!
  sh '${SCRIPT}' 2 15 "theirs-$$" >/dev/null 2>&1 &
  theirs_parent=$!
  sleep 3
  mine=$(pgrep -P "$mine_parent" || true)
  theirs=$(pgrep -P "$theirs_parent" || true)
  [ -n "$mine" ] && [ -n "$theirs" ] || exit 2
  sh '${SCRIPT}' --reap "mine-$$" >/dev/null 2>&1 || exit 5
  sleep 1
  for p in $mine; do kill -0 "$p" 2>/dev/null && { kill -9 $mine $theirs 2>/dev/null; exit 3; }; done
  # THE GUARANTEE: the other session's run is untouched. A pattern-wide kill loses this.
  for p in $theirs; do kill -0 "$p" 2>/dev/null || { kill -9 $theirs 2>/dev/null; exit 4; }; done
  sh '${SCRIPT}' --reap "theirs-$$" >/dev/null 2>&1
  exit 0
`

check('--reap stops one run and leaves a concurrent one alive', () => {
  const reap = spawnSync('/bin/sh', ['-c', REAP_IS_SCOPED], { encoding: 'utf8', timeout: 120000 })
  const said = {
    2: 'one of the two bursts started no workers to observe',
    3: 'the reaped run survived its own token',
    4: "the reap took out the OTHER run's workers — the scoping is gone",
    5: '--reap exited non-zero',
    null: 'the shell was killed or timed out',
  }
  assert.equal(reap.status, 0, said[reap.status] ?? reap.stderr)
})

check('--reap refuses a token it never recorded', () => {
  const result = sh(SCRIPT, ['--reap', 'no-such-run-988'])
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /no run recorded/)
})

// Read-only by construction: an agent runs it on a machine it does not own, so a mode that
// could signal anything would be a worse outage than the orphans it reports.
check('--orphans reports without killing', () => {
  const result = sh(SCRIPT, ['--orphans'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /load-burst: (no PPID-1 process|ownerless processes)/)
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

report('load-burst')
