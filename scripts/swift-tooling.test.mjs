#!/usr/bin/env node
// Tests for the three Swift shell entrypoints, run via `bun run test:hooks`.
//
// They all skip when the toolchain is absent, which is right on a Linux runner and on a
// TypeScript-only contributor's machine — and catastrophic in the macOS CI job, where a
// missing binary would report Success without checking a line. `ARGO_REQUIRE_SWIFT_TOOLS`
// is what turns each skip into a failure; these tests are the proof it does.
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

// The tools live in Homebrew's prefix, so a PATH of the system directories alone is a
// faithful "not installed" — except for `swift`, which Xcode shims into /usr/bin. Hiding
// that one needs a PATH holding nothing but the handful of binaries the scripts call.
const scratch = mkdtempSync(path.join(tmpdir(), 'argo-swift-tooling-'))
const bareBin = path.join(scratch, 'bare-bin')
const stubBin = path.join(scratch, 'stub-bin')
for (const dir of [bareBin, stubBin]) {
  mkdirSync(dir, { recursive: true })
}
for (const tool of ['uname', 'dirname']) {
  // Resolved rather than hardcoded: /usr/bin on macOS, /bin on some Linux images.
  const resolved = spawnSync('/bin/sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' })
  symlinkSync(resolved.stdout.trim(), path.join(bareBin, tool))
}

// A stub records the argv it was called with, so the tests can assert on the flags a script
// builds without running the real formatter over the tree.
const ARGV_LOG = path.join(scratch, 'argv.log')
function stub(name) {
  const file = path.join(stubBin, name)
  writeFileSync(file, `#!/bin/sh\nprintf '%s\\n' "$@" >> '${ARGV_LOG}'\n`)
  chmodSync(file, 0o755)
}
for (const tool of ['swiftformat', 'swiftlint', 'swift']) {
  stub(tool)
}

function run(script, { args = [], env = {}, pathValue }) {
  rmSync(ARGV_LOG, { force: true })
  // /bin/sh by absolute path: the bare PATH below deliberately holds no shell.
  const result = spawnSync('/bin/sh', [script, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { PATH: pathValue, HOME: process.env.HOME, ...env },
  })
  const argv = existsSync(ARGV_LOG) ? readFileSync(ARGV_LOG, 'utf8').trim().split('\n') : []
  return { ...result, argv, output: `${result.stdout}${result.stderr}` }
}

const MISSING = { pathValue: '/usr/bin:/bin' }
const STUBBED = { pathValue: `${stubBin}:/usr/bin:/bin` }
const STRICT = { ARGO_REQUIRE_SWIFT_TOOLS: '1' }

const LINT = 'scripts/swift-lint.sh'
const FORMAT = 'scripts/swift-format.sh'
const TEST = 'apps/macOS/scripts/swift-test.sh'

for (const [script, tool] of [
  [LINT, 'swiftlint'],
  [FORMAT, 'swiftformat'],
]) {
  check(`${script} skips when ${tool} is absent`, () => {
    const result = run(script, { ...MISSING, args: ['apps/macOS'] })
    assert.equal(result.status, 0)
    assert.match(result.output, /skipping/)
  })

  check(`${script} fails when ${tool} is absent under ARGO_REQUIRE_SWIFT_TOOLS`, () => {
    const result = run(script, { ...MISSING, args: ['apps/macOS'], env: STRICT })
    // Status 1 exactly, and the flag named: any non-zero would also satisfy `notEqual(0)`,
    // including the script erroring for an unrelated reason.
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, new RegExp(`${tool}.*ARGO_REQUIRE_SWIFT_TOOLS is set`))
    assert.doesNotMatch(result.output, /skipping/)
  })
}

// The bare PATH trips whichever of the script's two guards comes first: on Linux that is the
// `uname` check, on macOS the missing `swift`. Either way the posture under test is the same.
const BARE = { pathValue: bareBin }

check('swift-test.sh skips where Swift cannot run', () => {
  const result = run(TEST, BARE)
  assert.equal(result.status, 0, `expected a skip, got: ${result.output}`)
  assert.match(result.output, /skipping/)
})

check('swift-test.sh fails there instead under ARGO_REQUIRE_SWIFT_TOOLS', () => {
  const result = run(TEST, { ...BARE, env: STRICT })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /ARGO_REQUIRE_SWIFT_TOOLS is set/)
  assert.doesNotMatch(result.output, /skipping/)
})

check('swift-format.sh rewrites in place by default', () => {
  const result = run(FORMAT, { ...STUBBED, args: ['apps/macOS/Argo/ArgoApp.swift'] })
  assert.equal(result.status, 0, result.output)
  assert.deepEqual(
    result.argv.filter((arg) => arg === '--lint'),
    [],
  )
  assert.ok(result.argv.includes('apps/macOS/Argo/ArgoApp.swift'))
})

check('swift-format.sh --check lints instead, over the whole app when given no paths', () => {
  const result = run(FORMAT, { ...STUBBED, args: ['--check'] })
  assert.equal(result.status, 0, result.output)
  assert.ok(result.argv.includes('--lint'), `no --lint in: ${result.argv.join(' ')}`)
  assert.ok(result.argv.includes('apps/macOS'))
})

rmSync(scratch, { recursive: true, force: true })

if (failures) {
  console.error(`\n${failures} Swift tooling test(s) failed`)
  process.exit(1)
}
console.log('  swift tooling: all checks passed')
