#!/usr/bin/env node
// Tests for which runner `apps/macOS/scripts/e2e-test.sh` picks, run via `bun run test:hooks`.
//
// The router exists for ONE safety property: a run that nobody opted into must never reach
// `e2e-host.sh`, which drives the real WindowServer and holds the mouse and keyboard for its whole
// length. That property is invisible to every other suite here — the Swift tests cannot see a
// shell script, and actually running either path would take the machine over, which is the thing
// being prevented. So the runners are stubbed and only the CHOICE is asserted.
//
// Pure `sh` and stubs, so it runs on the Linux job alongside the other hook tests; nothing here
// needs Xcode, Tart, or a screen.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
const ROUTER = path.join(REPO_ROOT, 'apps/macOS/scripts/e2e-test.sh')

// A tree shaped like `apps/macOS`, holding the real router and stubs for the two runners. Each
// stub prints which one it is and the arguments it received, so a test can assert both the choice
// and that a filter survived the trip.
const scratch = mkdtempSync(path.join(tmpdir(), 'argo-e2e-routing-'))
const scripts = path.join(scratch, 'scripts')
mkdirSync(scripts, { recursive: true })
copyFileSync(ROUTER, path.join(scripts, 'e2e-test.sh'))
for (const runner of ['e2e-vm', 'e2e-host']) {
  writeFileSync(path.join(scripts, `${runner}.sh`), `#!/bin/sh\necho "${runner} ARGS:$*"\n`)
}

function route(args = [], env = {}) {
  const result = spawnSync('/bin/sh', ['scripts/e2e-test.sh', ...args], {
    cwd: scratch,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return `${result.stdout}${result.stderr}`
}

check('a bare run goes to the VM', () => {
  assert.match(route(), /e2e-vm ARGS:/)
})

check('a bare run never reaches the host runner', () => {
  assert.doesNotMatch(route(), /e2e-host/)
})

check('--host opts in', () => {
  assert.match(route(['--host']), /e2e-host ARGS:/)
})

check('ARGO_E2E_HOST=1 opts in', () => {
  assert.match(route([], { ARGO_E2E_HOST: '1' }), /e2e-host ARGS:/)
})

// The obvious way to turn an env toggle off. A non-emptiness test would read each of these as
// opting IN, which is the one direction this flag must never get wrong.
for (const value of ['0', 'false', 'no', '']) {
  check(`ARGO_E2E_HOST=${JSON.stringify(value)} still goes to the VM`, () => {
    assert.match(route([], { ARGO_E2E_HOST: value }), /e2e-vm ARGS:/)
  })
}

// `--host` is documented alongside `-only-testing:`, so it has to be recognised wherever it lands.
// Read off $1 alone it would be forwarded to the guest as an xcodebuild argument, and the run
// would boot a VM and sync a tree before failing on a flag it was never meant to see.
check('--host is recognised after another argument', () => {
  const out = route(['-only-testing:ArgoE2ETests/FooTests', '--host'])
  assert.match(out, /e2e-host ARGS:/)
  assert.doesNotMatch(out, /--host/)
})

check('a test filter reaches the VM runner intact', () => {
  assert.match(
    route(['-only-testing:ArgoE2ETests/FooTests']),
    /ARGS: ?-only-testing:ArgoE2ETests\/FooTests/,
  )
})

check('an argument containing spaces survives as one argument', () => {
  assert.match(route(['-resultBundlePath', '/tmp/a b/out']), /-resultBundlePath \/tmp\/a b\/out/)
})

check("the host runner's exit code reaches the caller", () => {
  writeFileSync(path.join(scripts, 'e2e-host.sh'), '#!/bin/sh\nexit 7\n')
  const result = spawnSync('/bin/sh', ['scripts/e2e-test.sh', '--host'], { cwd: scratch })
  assert.equal(result.status, 7)
})

check("the VM runner's exit code reaches the caller", () => {
  writeFileSync(path.join(scripts, 'e2e-vm.sh'), '#!/bin/sh\nexit 9\n')
  const result = spawnSync('/bin/sh', ['scripts/e2e-test.sh'], { cwd: scratch })
  assert.equal(result.status, 9)
})

rmSync(scratch, { recursive: true, force: true })

if (failures > 0) {
  console.error(`\n${failures} e2e routing test(s) failed`)
  process.exit(1)
}
console.log('\ne2e routing tests passed')
