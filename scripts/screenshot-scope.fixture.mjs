// The throwaway tree `screenshot-scope.test.mjs` runs `screenshot.sh` inside, and the scaffolding
// its assertions read the run with.
//
// The script under test is the shipped file itself, symlinked in so that `dirname "$0"` lands
// here — a copy could drift, and a fake would prove nothing. Everything it calls is a stub, so
// which process the script talks to is readable without building or launching Argo.

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
  rmSync(scratch, { recursive: true, force: true })
  reportChecks(suite)
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(path.join(tmpdir(), 'argo-screenshot-scope-'))
const appDir = path.join(scratch, 'apps', 'macOS')
const script = path.join(appDir, 'scripts', 'screenshot.sh')
const stubDir = path.join(scratch, 'bin')
const callLog = path.join(scratch, 'calls.log')
const appBinary = path.join(appDir, 'build/Build/Products/Debug/Argo.app/Contents/MacOS/Argo')
const out = path.join(scratch, 'out', 'shot.png')

for (const dir of [path.join(appDir, 'scripts'), path.dirname(appBinary), stubDir]) {
  mkdirSync(dir, { recursive: true })
}
for (const name of ['screenshot.sh', 'WindowID.swift']) {
  symlinkSync(path.join(REPO_ROOT, 'apps/macOS/scripts', name), path.join(appDir, 'scripts', name))
}
// PROJECT_ROOT comes from `git rev-parse`, so the throwaway tree has to be a repository.
spawnSync('git', ['init', '-q'], { cwd: scratch })

function write(file, body) {
  writeFileSync(file, body)
  chmodSync(file, 0o755)
}

// Every stub logs `<name> <argv…>` on one line, so a failure can name both the tool and what it
// was told to do — "osascript ran" and "osascript quit Argo" are different failures.
function stub(name, body = '') {
  write(path.join(stubDir, name), `#!/bin/sh\nprintf '${name} %s\\n' "$*" >> '${callLog}'\n${body}`)
}
for (const name of ['xcodebuild', 'osascript', 'open']) {
  stub(name)
}
stub('pgrep', 'exit 0\n')
stub('screencapture', '[ -n "$STUB_CAPTURE_FAILS" ] && exit 1\nshift 2; : > "$2"\n')
// `swift scripts/WindowID.swift <arg>`: echo back the argument it was handed, as the window id, so
// a test can read what the script believes identifies its window. The STUB_ knobs belong to the
// stubs, so the script keeps no branch that exists only for tests.
stub('swift', '[ -n "$STUB_NO_WINDOW" ] && exit 1\necho "$2"\n')

// The stand-in for the app records its own pid and then stays up, so whether the script closed it
// is a question about a live process rather than about a line in a log. It holds whatever stdout it
// was given for that whole time, which is what lets a test see the script pass its own pipe to a
// process it deliberately leaves running.
write(
  appBinary,
  [
    '#!/bin/sh',
    `printf 'argo %s %s\\n' "$$" "$*" >> '${callLog}'`,
    'i=0',
    'while [ "$i" -lt 300 ]; do i=$((i + 1)); sleep 0.1; done',
  ].join('\n'),
)

export function isRunning(pid) {
  try {
    process.kill(Number(pid), 0)
    return true
  } catch {
    return false
  }
}

// The script signals its instance and returns without reaping it, so "did it close" is only
// answerable after a beat. Spun rather than slept, so a passing run costs only the beat it needs.
export function settled(pid) {
  const deadline = Date.now() + 5000
  while (isRunning(pid) && Date.now() < deadline) spawnSync('/bin/sleep', ['0.05'])
  return !isRunning(pid)
}

export function run(env = {}) {
  rmSync(callLog, { force: true })
  const result = spawnSync('/bin/sh', [script, out], {
    cwd: appDir,
    encoding: 'utf8',
    env: {
      PATH: `${stubDir}:/usr/bin:/bin`,
      HOME: process.env.HOME,
      STUB_NO_WINDOW: '',
      STUB_CAPTURE_FAILS: '',
      ...env,
    },
    // Longer than the slowest honest run (the 10s window poll), shorter than the stub app's life,
    // so a script that hands the app its stdout fails a test instead of wedging the suite.
    timeout: 25_000,
  })
  const calls = existsSync(callLog) ? readFileSync(callLog, 'utf8').trimEnd().split('\n') : []
  return { ...result, calls, output: `${result.stdout}${result.stderr}` }
}

// The launch the script made, told from a bystander's by its flags: only the script passes any.
export const launchLine = (calls) => calls.find((line) => /^argo \d+ .*--project/.test(line))
export const launched = (calls) => launchLine(calls)?.split(' ')[1]

// A second Argo, started the way a developer's own build is: nothing to do with this render.
export function startBystander() {
  // Its output is detached here, not in the stub, so the stub still holds whatever stdout the
  // script under test hands it — which is what the shell-handback check reads.
  const started = spawnSync('/bin/sh', ['-c', `${appBinary} >/dev/null 2>&1 & echo $!`], {
    encoding: 'utf8',
  })
  return Number(started.stdout.trim())
}
