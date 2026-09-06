#!/usr/bin/env node
// What `hang-sample.sh` owes a machine running more than one Argo (#1560).
//
// Every worktree builds its own `Release/Argo.app`, and all of them carry the process name
// `Argo`. The script used to take `pgrep -x Argo | head -1` and never say which copy that was,
// so a sample from the wrong build read as a fact about the build being measured. Two things
// are held here: the target is NAMED on the line that names the pid, and more than one match
// refuses instead of picking.
//
// `ps` is shimmed onto PATH rather than two Argos started for real: processes sharing a name and
// differing only in path cannot be staged portably — a copied platform binary is SIGKILLed by the
// macOS signature check, and `ps -o comm=` prints no path at all on the Linux job. The shim makes
// the candidate table the input it logically is.
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

mkdirSync(BIN, { recursive: true })
process.on('exit', () => rmSync(SCRATCH, { recursive: true, force: true }))

// A candidate table as `{ pid: executablePath }`, behind the two `ps` invocations the script
// resolves a target through: `-Ao pid=,comm=` lists the machine, and `-o comm= -p <pid>` answers
// for one. The second exits 1 saying nothing for a pid the table does not hold, which is how a
// real `ps` reports a process that is gone — the case a caller-passed `--pid` has to survive.
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

// THE BUG. Two builds, and the old script sampled whichever the kernel listed first.
check('more than one match refuses instead of choosing', () => {
  stageProcesses({ 4242: ONE, 5353: TWO })
  const result = runHangSample(['--once'], 20000)
  assert.equal(result.status, 1, `expected a refusal, got ${result.status}\n${result.stdout}`)
  assert.match(result.stderr, /more than one/)
})

// A refusal a caller cannot act on is only half the fix: both paths have to be on the page, or
// there is no way to tell which pid is the build being measured.
check('the refusal lists every candidate with its path', () => {
  stageProcesses({ 4242: ONE, 5353: TWO })
  const said = runHangSample(['--once'], 20000).stderr
  for (const [pid, exe] of [
    ['4242', ONE],
    ['5353', TWO],
  ]) {
    assert.match(said, new RegExp(`${pid}\\s+${exe.replaceAll('/', '\\/')}`), said)
  }
  assert.match(said, /--pid/, 'the refusal never says how to choose')
})

// A named pid settles the ambiguity the check above refuses on, and the announcement is what
// proves it took the copy that was named rather than the one `head -1` used to hand it. The
// exit status is not read: `sample` is real here, and no real process wears these pids.
check('--pid takes the copy the caller names', () => {
  stageProcesses({ 4242: ONE, 5353: TWO })
  const said = runHangSample(['--pid', '5353', '--once'], 20000).stdout
  assert.match(said, new RegExp(`5353.*${TWO.replaceAll('/', '\\/')}`), said)
  assert.doesNotMatch(said, /4242/, said)
})

check('--pid refuses a process that is not there', () => {
  stageProcesses({ 4242: ONE })
  const result = runHangSample(['--pid', '9999', '--once'], 20000)
  assert.equal(result.status, 1, result.stdout)
  assert.match(result.stderr, /9999 is not running/)
})

// THE OTHER HALF. One match is no longer allowed to be silent about which one it was.
check('--once names the executable beside the pid', () => {
  stageProcesses({ 4242: ONE })
  const said = runHangSample(['--once'], 20000).stdout
  assert.match(said, new RegExp(`4242.*${ONE.replaceAll('/', '\\/')}`), said)
})

// Watch mode never returns, so it is read off its opening lines and then killed. The banner is
// where a watch says what it is watching, and it carried a bare pid.
check('watch mode names the executable beside the pid', () => {
  stageProcesses({ 4242: ONE })
  const said = runHangSample([], 4000).stdout
  assert.match(said, new RegExp(`4242.*${ONE.replaceAll('/', '\\/')}`), said)
})

check('no process at all is still a refusal that names what it looked for', () => {
  stageProcesses({})
  const result = runHangSample(['--once'], 20000)
  assert.equal(result.status, 1, result.stdout)
  assert.match(result.stderr, /no process named Argo/)
})

// The listing is the whole machine, so the name filter is the only thing keeping a hundred other
// processes out of the candidate list — and an Argo on its way out is listed as `(Argo)`, which
// would refuse a run as ambiguous while being the one thing that cannot be sampled.
check('another process, and an exiting Argo, are not candidates', () => {
  stageProcesses({
    4242: ONE,
    707: '/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder',
    16376: '(Argo)',
  })
  const said = runHangSample(['--once'], 20000).stdout
  assert.match(said, new RegExp(`4242.*${ONE.replaceAll('/', '\\/')}`), said)
})

check('an unknown argument is refused rather than ignored', () => {
  stageProcesses({ 4242: ONE })
  const result = runHangSample(['--twice'], 20000)
  assert.equal(result.status, 1, result.stdout)
  assert.match(result.stderr, /--twice/)
})

report('hang-sample')
