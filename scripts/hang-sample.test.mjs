#!/usr/bin/env node
// What `hang-sample.sh` owes a machine running more than one Argo (#1560): every line that names
// a pid names its executable, and an ambiguous target refuses rather than resolves.
//
// `ps` is shimmed onto PATH rather than two Argos started for real, because processes sharing a
// name and differing only in path cannot be staged portably: a copied platform binary is SIGKILLed
// by the macOS signature check, and `ps -o comm=` prints no path at all on the Linux job.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, report } from './check-harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, 'hang-sample.sh')
const SCRATCH = path.join(process.env.TMPDIR ?? '/tmp', `argo-hang-sample-${process.pid}`)
const BIN = path.join(SCRATCH, 'bin')
const ONE = '/one/build/Build/Products/Release/Argo.app/Contents/MacOS/Argo'
const TWO = '/two/build/Build/Products/Release/Argo.app/Contents/MacOS/Argo'

// A pid nothing can be running under, for the one check that turns on the target being GONE.
//
// It staged the same literal 4242 as every other check, and that check is the only one whose
// verdict depends on `kill -0` failing. On a busy CI runner 4242 is sometimes a live process, and
// then the watch loop polls it happily, never prints "has gone", and the 4s read window expires:
// a red PR whose diff was three markdown files. Reproduced by staging a live pid deliberately,
// which fails with exactly the CI error.
//
// `2**31 - 1` is past every kernel's pid ceiling — Linux caps `pid_max` at 2**22, macOS at 99999 —
// so unlike a merely-unused pid it cannot be allocated between here and the run. Asserted rather
// than assumed, because "the test is fine, the pid is free" is the belief that just cost a PR.
const GONE = 2 ** 31 - 1
try {
  process.kill(GONE, 0)
  throw new Error(`pid ${GONE} answered a signal; this suite needs a pid that cannot exist`)
} catch (err) {
  // ESRCH is "no such process" and EINVAL is "no such pid is possible". Either is what we want;
  // EPERM would mean something is running there and we simply may not signal it.
  if (err.code !== 'ESRCH' && err.code !== 'EINVAL') throw err
}

mkdirSync(BIN, { recursive: true })
process.on('exit', () => rmSync(SCRATCH, { recursive: true, force: true }))

// A candidate table as `{ pid: executablePath }`, behind the two `ps` invocations the script
// resolves a target through: `-Ao pid=,comm=` lists the machine, and `-o comm= -p <pid>` answers
// for one. The second exits 1 saying nothing for a pid the table does not hold, which is how a
// real `ps` reports a process that is gone.
function stageProcesses(table) {
  const listing = Object.entries(table)
    .map(([pid, exe]) => `echo '${pid} ${exe}'`)
    .join('\n')
  const arms = Object.entries(table)
    .map(([pid, exe]) => `    ${pid}) printf '%s\\n' '${exe}'; exit 0 ;;`)
    .join('\n')
  writeFileSync(
    path.join(BIN, 'ps'),
    `#!/bin/sh
case "$*" in
  *-A*)
${listing}
    exit 0
    ;;
esac
for one in "$@"; do
  case $one in
${arms}
  esac
done
exit 1
`,
  )
  chmodSync(path.join(BIN, 'ps'), 0o755)
}

const runHangSample = (args, timeout) =>
  spawnSync('/bin/sh', [SCRIPT, ...args], {
    encoding: 'utf8',
    timeout,
    env: {
      ...process.env,
      PATH: `${BIN}:${process.env.PATH}`,
      ARGO_HANG_OUT: path.join(SCRATCH, 'out'),
    },
  })

// The whole acceptance criterion in one assertion: a pid and the executable behind it, on ONE
// line — `[^\n]*` and not `.*`, or a candidate list would satisfy it by naming them on two.
const namesTarget = (said, pid, exe) =>
  assert.match(said, new RegExp(`${pid}[^\\n]*${exe.replaceAll('.', '\\.')}`), said)

check('more than one match refuses instead of choosing', () => {
  stageProcesses({ 4242: ONE, 5353: TWO })
  const result = runHangSample(['--once'], 20000)
  assert.equal(result.status, 1, `expected a refusal, got ${result.status}\n${result.stdout}`)
  assert.match(result.stderr, /more than one/)
})

// A refusal a caller cannot act on is only half the fix.
check('the refusal lists every candidate with its path', () => {
  stageProcesses({ 4242: ONE, 5353: TWO })
  const said = runHangSample(['--once'], 20000).stderr
  namesTarget(said, 4242, ONE)
  namesTarget(said, 5353, TWO)
  assert.match(said, /--pid/, 'the refusal never says how to choose')
})

// The exit status is not read here: `sample` is real, and no live process wears these pids.
check('--pid takes the copy the caller names', () => {
  stageProcesses({ 4242: ONE, 5353: TWO })
  const said = runHangSample(['--pid', '5353', '--once'], 20000).stdout
  namesTarget(said, 5353, TWO)
  assert.doesNotMatch(said, /4242/, said)
})

check('--pid refuses a process that is not there', () => {
  stageProcesses({ 4242: ONE })
  const result = runHangSample(['--pid', '9999', '--once'], 20000)
  assert.equal(result.status, 1, result.stdout)
  assert.match(result.stderr, /9999 is not running/)
})

check('--once names the executable beside the pid', () => {
  stageProcesses({ 4242: ONE })
  namesTarget(runHangSample(['--once'], 20000).stdout, 4242, ONE)
})

// A sample that cannot be taken used to exit silently under `set -e`.
check('a sample that fails says which target it failed on', () => {
  stageProcesses({ 4242: ONE })
  const result = runHangSample(['--once'], 20000)
  assert.equal(result.status, 1, result.stdout)
  namesTarget(result.stderr, 4242, ONE)
})

// Watch mode never returns on a live target, so it is read off its opening lines and killed.
check('watch mode names the executable beside the pid', () => {
  stageProcesses({ 4242: ONE })
  namesTarget(runHangSample([], 4000).stdout, 4242, ONE)
})

// `GONE` and not 4242: this is the one check whose verdict is the target being gone, so it is the
// one check a live pid silently inverts. See GONE's own note.
check('a watch whose target goes away names it on the way out', () => {
  stageProcesses({ [GONE]: ONE })
  const said = runHangSample([], 4000).stdout
  assert.match(said, /has gone/, said)
  namesTarget(said.slice(said.indexOf('has gone') - 200), GONE, ONE)
})

check('no process at all is still a refusal that names what it looked for', () => {
  stageProcesses({})
  const result = runHangSample(['--once'], 20000)
  assert.equal(result.status, 1, result.stdout)
  assert.match(result.stderr, /no process named Argo/)
})

// The listing is the whole machine, so the name filter is all that keeps a hundred other processes
// out — and an Argo on its way out reads `(Argo)`, which would refuse a run as ambiguous.
check('another process, and an exiting Argo, are not candidates', () => {
  stageProcesses({
    4242: ONE,
    707: '/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder',
    16376: '(Argo)',
  })
  namesTarget(runHangSample(['--once'], 20000).stdout, 4242, ONE)
})

check('an unknown argument is refused rather than ignored', () => {
  stageProcesses({ 4242: ONE })
  const result = runHangSample(['--twice'], 20000)
  assert.equal(result.status, 1, result.stdout)
  assert.match(result.stderr, /--twice/)
})

report('hang-sample')
