#!/usr/bin/env node
// Tests that `screenshot.sh` addresses only the Argo it launched, run via `bun run test:hooks`.
//
// The bug these pin (#885) is invisible to every other gate: the script used to quit any process
// named Argo, so a render closed the dev build the person at the machine was looking at, and
// `specimens.sh` did it once per specimen. The fix is pid scoping, and pid scoping is only
// checkable by watching which process the script talks to.
//
// The script under test is the shipped file itself, symlinked into a throwaway tree so that
// `dirname "$0"` lands there — a copy could drift, and a fake would prove nothing.
import assert from 'node:assert/strict'
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

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(path.join(tmpdir(), 'argo-screenshot-scope-'))
const APP_DIR = path.join(scratch, 'apps', 'macOS')
const SCRIPT = path.join(APP_DIR, 'scripts', 'screenshot.sh')
const BIN = path.join(scratch, 'bin')
const LOG = path.join(scratch, 'calls.log')
const APP_BIN = path.join(APP_DIR, 'build/Build/Products/Debug/Argo.app/Contents/MacOS/Argo')

mkdirSync(path.join(APP_DIR, 'scripts'), { recursive: true })
mkdirSync(path.dirname(APP_BIN), { recursive: true })
mkdirSync(BIN, { recursive: true })
for (const name of ['screenshot.sh', 'WindowID.swift']) {
  symlinkSync(path.join(REPO_ROOT, 'apps/macOS/scripts', name), path.join(APP_DIR, 'scripts', name))
}
// PROJECT_ROOT comes from `git rev-parse`, so the throwaway tree has to be a repository.
spawnSync('git', ['init', '-q'], { cwd: scratch })

function write(file, body) {
  writeFileSync(file, body)
  chmodSync(file, 0o755)
}

/// Every stub logs `<name> <argv…>` on one line, so an assertion can name both the tool and what
/// it was told to do — "osascript ran" and "osascript quit Argo" are different failures.
function stub(name, body = '') {
  write(path.join(BIN, name), `#!/bin/sh\nprintf '${name} %s\\n' "$*" >> '${LOG}'\n${body}`)
}
for (const name of ['xcodebuild', 'osascript', 'open']) {
  stub(name)
}
stub('pgrep', 'exit 0\n')
stub('screencapture', 'shift 2; : > "$2"\n') // -o -x -l<id> <out>
// `swift scripts/WindowID.swift <arg>`: echo the argument it was handed back as the window id, so
// a test can read what the script believes identifies its window. STUB_NO_WINDOW plays the app
// that never puts one up — a stub's own knob, so the script keeps no branch that exists for tests.
stub('swift', '[ -n "$STUB_NO_WINDOW" ] && exit 1\necho "$2"\n')

// The stand-in for the app records its own pid and then stays up, so whether the script closed it
// is a question about a live process rather than about a line in a log. It holds whatever stdout
// it was given for that whole time, which is what makes the ARGO_KEEP_RUNNING check below able to
// see the script handing its own pipe to a process it deliberately leaves running.
write(
  APP_BIN,
  [
    '#!/bin/sh',
    `printf 'argo %s %s\\n' "$$" "$*" >> '${LOG}'`,
    'i=0',
    'while [ "$i" -lt 300 ]; do i=$((i + 1)); sleep 0.1; done',
  ].join('\n'),
)

function isRunning(pid) {
  try {
    process.kill(Number(pid), 0)
    return true
  } catch {
    return false
  }
}

/// The script signals its instance and returns without reaping it, so "did it close" is only
/// answerable after a beat. Spun rather than slept, so a passing run costs only the beat it needs.
function settled(pid) {
  const deadline = Date.now() + 5000
  while (isRunning(pid) && Date.now() < deadline) spawnSync('/bin/sleep', ['0.05'])
  return !isRunning(pid)
}

function run({ args = [], env = {} } = {}) {
  rmSync(LOG, { force: true })
  const result = spawnSync('/bin/sh', [SCRIPT, ...args], {
    cwd: APP_DIR,
    encoding: 'utf8',
    env: { PATH: `${BIN}:/usr/bin:/bin`, HOME: process.env.HOME, STUB_NO_WINDOW: '', ...env },
    // Longer than the slowest honest run (the 10s window poll), shorter than the stub app's
    // life, so a script that hands the app its stdout fails here instead of wedging the suite.
    timeout: 25_000,
  })
  const calls = existsSync(LOG) ? readFileSync(LOG, 'utf8').trimEnd().split('\n') : []
  return { ...result, calls, output: `${result.stdout}${result.stderr}` }
}

const out = path.join(scratch, 'out', 'shot.png')
/// The launch the script made, told from a bystander's by its flags: only the script passes any.
const launchLine = (calls) => calls.find((line) => /^argo \d+ .*--project/.test(line))
const launched = (calls) => launchLine(calls)?.split(' ')[1]

check('launches the binary itself, and never addresses Argo by name', () => {
  const result = run({ args: [out], env: { ARGO_SPECIMEN: 'foundations' } })
  assert.equal(result.status, 0, result.output)
  // `open` activates an already-running bundle id instead of launching this build, which is why
  // the old script had to quit every Argo first; `pgrep -x Argo` is how it found them.
  const named = result.calls.filter((line) => /^(open|pgrep) |application "Argo"/.test(line))
  assert.deepEqual(named, [], 'the script still reaches an Argo by name')
  const argv = launchLine(result.calls)
  assert.ok(argv, `the app bundle's binary was never run: ${result.output}`)
  assert.match(argv, /--project /)
  assert.match(argv, /--specimen foundations/)
  assert.doesNotMatch(argv, /--args/)
})

check('identifies the window by the pid it launched', () => {
  const result = run({ args: [out] })
  assert.equal(result.status, 0, result.output)
  const pid = launched(result.calls)
  assert.ok(
    result.calls.includes(`swift scripts/WindowID.swift ${pid}`),
    `WindowID was not asked about pid ${pid}: ${result.calls.join(' | ')}`,
  )
})

check('resizes by unix id rather than by process name', () => {
  const result = run({ args: [out], env: { ARGO_WINDOW_SIZE: '680x600' } })
  assert.equal(result.status, 0, result.output)
  const resize = result.calls.find((line) => /set size of front window/.test(line))
  assert.ok(resize, `no resize was attempted: ${result.calls.join(' | ')}`)
  assert.match(resize, new RegExp(`unix id is ${launched(result.calls)}\\b`))
  assert.match(resize, /\{680, 600\}/)
})

check('closes the instance it launched, and leaves a bystander Argo running', () => {
  // #885 in one assertion: the bystander stands for the dev build somebody is looking at.
  // Its output is detached here, not in the stub, so that the stub still holds whatever stdout
  // the script under test hands it — which is what the ARGO_KEEP_RUNNING check reads.
  const launch = `${APP_BIN} >/dev/null 2>&1 & echo $!`
  const bystander = spawnSync('/bin/sh', ['-c', launch], { encoding: 'utf8' })
  const bystanderPid = Number(bystander.stdout.trim())
  const result = run({ args: [out] })
  assert.equal(result.status, 0, result.output)
  assert.ok(settled(launched(result.calls)), 'the launched app was left running')
  assert.ok(isRunning(bystanderPid), 'the render closed an Argo it did not launch')
  process.kill(bystanderPid)
})

check('ARGO_KEEP_RUNNING leaves it up, and the caller still gets its shell back', () => {
  // The launched app is a child of the script rather than detached by `open`, so it would
  // inherit the caller's stdout — and a run that leaves it up on purpose would then hang for
  // as long as the app lived. `run` returning at all while the app is still up is the check.
  const result = run({ args: [out], env: { ARGO_KEEP_RUNNING: '1' } })
  assert.equal(result.status, 0, result.output)
  const pid = launched(result.calls)
  assert.ok(isRunning(pid), 'the app was closed despite ARGO_KEEP_RUNNING')
  process.kill(Number(pid))
})

check('a window that never appears fails, and takes its own instance down with it', () => {
  const result = run({ args: [out], env: { STUB_NO_WINDOW: '1' } })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /no window/)
  assert.ok(settled(launched(result.calls)), 'a failed render orphaned its instance')
})

rmSync(scratch, { recursive: true, force: true })

if (failures) {
  console.error(`\n${failures} screenshot scoping test(s) failed`)
  process.exit(1)
}
console.log('  screenshot scoping: all checks passed')
