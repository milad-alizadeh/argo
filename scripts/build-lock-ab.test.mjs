#!/usr/bin/env node
// The cap experiment (#1440): every run in a window shares an arm, the arm follows the clock,
// the uncapped arm really is uncapped, the arm reaches the metrics row, and none of it happens
// unless it is switched on.
//
// An instrument that quietly biases what it measures is worse than no instrument, so most of
// what is checked here is the ways this could lie: arms that disagree between two lanes running
// at the same moment, a child that re-draws so one gate counts twice, or an experiment left on
// by default.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { LOCK, ROOT, workspace } from './build-lock.harness.mjs'
import { check, report } from './check-harness.mjs'

function run(dir, body, env = {}) {
  return execFileSync('sh', ['-c', `. "${LOCK}"\n${body}`], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ARGO_BUILD_LOCK_ROOT: path.join(dir, 'lock'),
      ARGO_BUILD_LOCK_SLOTS: '2',
      ...env,
    },
  })
}
const armOf = (out) => out.match(/arm:\[(.*)\]/)?.[1] ?? ''
const askArm = (dir, env) =>
  armOf(
    run(dir, 'build_lock_acquire\necho "arm:[$BUILD_LOCK_ARM]"', {
      ARGO_BUILD_LOCK_AB: 'on',
      ...env,
    }),
  )

// THE property the whole experiment rests on. The cap is a fact about the MACHINE, so two lanes
// running at the same moment must be in the same arm: an uncapped lane floods all twelve cores,
// and a capped lane measured beside it wears that cost and reports it as the cap's. Per-run
// alternation reads as the tidier experiment and silently measures nothing.
check('every run inside one window gets the same arm', () => {
  const dir = workspace()
  const seen = [askArm(dir), askArm(dir), askArm(dir), askArm(dir)]
  assert.equal(new Set(seen).size, 1, `lanes in one window disagreed: ${JSON.stringify(seen)}`)
  assert.match(seen[0], /^(capped|uncapped)$/)
  rmSync(dir, { recursive: true, force: true })
})

// And it does alternate, or the "A/B" is one arm with extra steps. A one-second window makes the
// clock do in three seconds what the real one does in an hour.
check('the arm follows the clock, so both arms come up', () => {
  const dir = workspace()
  const seen = new Set()
  const deadline = Date.now() + 6000
  while (seen.size < 2 && Date.now() < deadline) {
    seen.add(askArm(dir, { ARGO_BUILD_LOCK_AB_WINDOW: '1' }))
  }
  assert.deepEqual(
    [...seen].sort(),
    ['capped', 'uncapped'],
    `only saw ${JSON.stringify([...seen])}`,
  )
  rmSync(dir, { recursive: true, force: true })
})

// Off unless asked for. An experiment running by default would mean half of every ordinary day's
// builds were uncapped — the thing #1427 exists to prevent, done by an instrument nobody
// switched on.
check('no arm is drawn unless the experiment is switched on', () => {
  const dir = workspace()
  for (const ab of ['off', '', 'nonsense']) {
    assert.equal(askArm(dir, { ARGO_BUILD_LOCK_AB: ab }), '', `${ab || 'unset'} drew an arm`)
  }
  assert.match(
    readFileSync(LOCK, 'utf8'),
    /ARGO_BUILD_LOCK_AB:-off/,
    'the A/B must default to off, so an unset environment runs the capped path',
  )
  rmSync(dir, { recursive: true, force: true })
})

// The uncapped arm has to actually stop serialising, or the experiment compares the cap with
// itself and reports, honestly and uselessly, that the cap costs nothing.
check('the uncapped arm admits holders the capped arm would queue', () => {
  const dir = workspace()
  const log = path.join(dir, 'order')
  writeFileSync(
    path.join(dir, 'h.sh'),
    `
. "${LOCK}"
build_lock_acquire
echo "in $1" >> "${log}"
sleep 1
echo "out $1" >> "${log}"
`,
  )
  execFileSync('sh', ['-c', `sh "${dir}/h.sh" a & sh "${dir}/h.sh" b & wait`], {
    env: {
      ...process.env,
      ARGO_BUILD_LOCK_ROOT: path.join(dir, 'lock'),
      // One slot, which would serialise these two — unless the arm overrode it.
      ARGO_BUILD_LOCK_SLOTS: '1',
      ARGO_BUILD_LOCK_AB: 'uncapped',
    },
  })
  const lines = readFileSync(log, 'utf8').trim().split('\n')
  assert.equal(lines.length, 4, `expected four markers, got ${JSON.stringify(lines)}`)
  assert.match(lines[0], /^in /)
  assert.match(lines[1], /^in /, 'the uncapped arm must not serialise two holders')
  rmSync(dir, { recursive: true, force: true })
})

// The capped arm is the ordinary lock, unchanged. Worth pinning: an experiment whose control
// group is not the shipped behaviour answers a question nobody asked.
check('the capped arm still serialises on its slot count', () => {
  const dir = workspace()
  const log = path.join(dir, 'order')
  writeFileSync(
    path.join(dir, 'h.sh'),
    `
. "${LOCK}"
build_lock_acquire
echo "in $1" >> "${log}"
sleep 1
echo "out $1" >> "${log}"
`,
  )
  execFileSync('sh', ['-c', `sh "${dir}/h.sh" a & sh "${dir}/h.sh" b & wait`], {
    env: {
      ...process.env,
      ARGO_BUILD_LOCK_ROOT: path.join(dir, 'lock'),
      ARGO_BUILD_LOCK_SLOTS: '1',
      ARGO_BUILD_LOCK_AB: 'capped',
    },
  })
  const lines = readFileSync(log, 'utf8').trim().split('\n')
  assert.match(lines[1], /^out /, 'the capped arm must still hold two holders apart')
  rmSync(dir, { recursive: true, force: true })
})

// A gate and the `bun run test` it spawns are ONE observation. A child that drew its own arm
// would double-count the run, and — if the window flipped mid-gate — file the two halves under
// different arms.
check('a child inside its parent slot keeps the parent arm', () => {
  const dir = workspace()
  const out = run(
    dir,
    `build_lock_acquire
echo "arm:[$BUILD_LOCK_ARM]"
sh -c '. "${LOCK}"; build_lock_acquire; echo "child:[$BUILD_LOCK_ARM]"'`,
    { ARGO_BUILD_LOCK_AB: 'on', ARGO_BUILD_LOCK_SLOTS: '1' },
  )
  const parent = armOf(out)
  const child = out.match(/child:\[(.*)\]/)?.[1]
  assert.equal(child, parent, `the child drew its own arm: parent ${parent}, child ${child}`)
  rmSync(dir, { recursive: true, force: true })
})

// The arm has to reach the row, or the experiment is unreadable however well it alternates.
check('metrics.sh writes the arm as a tenth column', () => {
  const dir = workspace()
  const file = path.join(dir, 'metrics.tsv')
  run(
    dir,
    `. "${path.join(ROOT, 'scripts/metrics.sh')}"
build_lock_acquire
metric_append gate gate run 12 3`,
    { ARGO_BUILD_LOCK_AB: 'capped', ARGO_METRICS_FILE: file },
  )
  const columns = readFileSync(file, 'utf8').trim().split('\t')
  assert.equal(columns.length, 10, `expected ten columns, got ${columns.length}`)
  assert.equal(columns[9], 'capped')
  rmSync(dir, { recursive: true, force: true })
})

// With the experiment off the column is a placeholder rather than absent: a row with nine fields
// beside a row with ten would make every reader guess which layout it had.
check('the arm column is a placeholder when the experiment is off', () => {
  const dir = workspace()
  const file = path.join(dir, 'metrics.tsv')
  execFileSync(
    'sh',
    ['-c', `. "${path.join(ROOT, 'scripts/metrics.sh')}"\nmetric_append gate gate run 12 0`],
    { env: { ...process.env, ARGO_METRICS_FILE: file } },
  )
  const columns = readFileSync(file, 'utf8').trim().split('\t')
  assert.equal(columns.length, 10)
  assert.equal(columns[9], '-')
  rmSync(dir, { recursive: true, force: true })
})

report('build-lock-ab')
