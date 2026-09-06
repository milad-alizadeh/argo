// The throwaway tree `run-release-finder.test.mjs` runs `run-release.sh` inside, and the
// scaffolding its assertions read the run with.
//
// The script under test is the shipped file itself, symlinked in so that `dirname "$0"` lands
// here — a copy could drift, and a fake would prove nothing. The build it would otherwise do, and
// the process table it reads, are stubs, so which copy of Argo the script ends is readable
// without building or launching anything.

import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { report as reportChecks } from './check-harness.mjs'

// The scratch tree is this fixture's to clean, so the shared report is wrapped rather than
// called directly — a suite that exits 1 must not leave the tree behind either.
export function report(suite) {
  for (const pid of sleepers) {
    try {
      process.kill(pid)
    } catch {}
  }
  rmSync(scratch, { recursive: true, force: true })
  reportChecks(suite)
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(path.join(tmpdir(), 'argo-run-release-'))
const appDir = path.join(scratch, 'apps', 'macOS')
const script = path.join(appDir, 'scripts', 'run-release.sh')
const stubDir = path.join(scratch, 'bin')
const callLog = path.join(scratch, 'calls.log')
const rowsFile = path.join(scratch, 'ps-rows')

export const PRODUCT = path.join(appDir, 'build/Build/Products/Release/Argo.app')
export const BINARY = path.join(PRODUCT, 'Contents/MacOS/Argo')
// Where a developer's own copy lives: a path this build is not, so the script must leave it be.
export const OTHER_BINARY = '/Applications/Argo.app/Contents/MacOS/Argo'

for (const dir of [path.join(appDir, 'scripts'), path.dirname(BINARY), stubDir]) {
  mkdirSync(dir, { recursive: true })
}
symlinkSync(path.join(REPO_ROOT, 'apps/macOS/scripts/run-release.sh'), script)

function write(file, body) {
  writeFileSync(file, body)
  chmodSync(file, 0o755)
}

// Every stub logs `<name> <argv…>` on one line, so a failure can name both the tool and what it
// was told to do — "the script asked pgrep" and "the script asked ps" are different failures.
function stub(name, body = '') {
  write(path.join(stubDir, name), `#!/bin/sh\nprintf '${name} %s\\n' "$*" >> '${callLog}'\n${body}`)
}
stub('open')
// The finder this suite exists for used to be `pgrep -x Argo`, and on the machine that reported
// #1568 that answers nothing while Argo is running. The stub answers nothing too, so a script
// that goes back to asking it fails here rather than on somebody's desk.
stub('pgrep', 'exit 1\n')
// The build is not what is under test, and it is the one step that would cost minutes.
write(
  path.join(appDir, 'scripts', 'build.sh'),
  `#!/bin/sh\necho "build: $ARGO_BUILD_CONFIGURATION"\n`,
)
write(BINARY, '#!/bin/sh\ni=0\nwhile [ "$i" -lt 300 ]; do i=$((i + 1)); sleep 0.1; done\n')

// The process table the script reads, in the shape macOS `ps -Ao pid=,comm=` writes it: the pid
// right-aligned in a fixed column, then the executable path. Rows marked `live` are dropped once
// their process has gone, so the settle loop ends the way it would against a real table; a row
// marked `always` stands for one `ps` reports whatever we do, which is how the exiting `(Argo)`
// case is put in front of the script.
stub(
  'ps',
  [
    `while IFS=' ' read -r mode pid rest; do`,
    '  [ -n "$mode" ] || continue',
    '  if [ "$mode" = live ]; then kill -0 "$pid" 2>/dev/null || continue; fi',
    '  printf "%5s %s\\n" "$pid" "$rest"',
    `done < '${rowsFile}'`,
  ].join('\n'),
)

const sleepers = []

// A process standing in for one of the Argos in the table, started so that "was it ended" is a
// question about a live process rather than about a line in a log.
export function startArgo() {
  const started = spawnSync('/bin/sh', ['-c', `${BINARY} >/dev/null 2>&1 & echo $!`], {
    encoding: 'utf8',
  })
  const pid = Number(started.stdout.trim())
  sleepers.push(pid)
  return pid
}

export function isRunning(pid) {
  try {
    process.kill(Number(pid), 0)
    return true
  } catch {
    return false
  }
}

// The script signals a copy and returns without reaping it, so "did it end" is only answerable
// after a beat. Spun rather than slept, so a passing run costs only the beat it needs.
export function settled(pid) {
  const deadline = Date.now() + 5000
  while (isRunning(pid) && Date.now() < deadline) spawnSync('/bin/sleep', ['0.05'])
  return !isRunning(pid)
}

// `rows` are `[mode, pid, path]`, written in the order `ps` should report them.
export function run(rows, args = []) {
  rmSync(callLog, { force: true })
  writeFileSync(rowsFile, `${rows.map((row) => row.join(' ')).join('\n')}\n`)
  const result = spawnSync('/bin/sh', [script, ...args], {
    cwd: appDir,
    encoding: 'utf8',
    env: { PATH: `${stubDir}:/usr/bin:/bin`, HOME: process.env.HOME },
    // Longer than the slowest honest run (the 2s settle), shorter than a stub Argo's life, so a
    // script that waits on a copy it cannot end fails a test instead of wedging the suite.
    timeout: 25_000,
  })
  const calls = existsSync(callLog) ? readFileSync(callLog, 'utf8').trimEnd().split('\n') : []
  return { ...result, calls, output: `${result.stdout}${result.stderr}` }
}

export const asked = (calls, tool) => calls.filter((line) => line.startsWith(`${tool} `))
