#!/usr/bin/env node
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
// Tests for the three Swift shell entrypoints, run via `bun run test:hooks`.
//
// They all skip when the toolchain is absent, which is right on a Linux runner and on a
// TypeScript-only contributor's machine — and catastrophic in the macOS CI job, where a
// missing binary would report Success without checking a line. `ARGO_REQUIRE_SWIFT_TOOLS`
// is what turns each skip into a failure; these tests are the proof it does.
import { check, report } from './check-harness.mjs'

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

// `swift test` EXITS 0 ON A FAILED RUN (#918), so swift-test.sh may believe only the xUnit
// report. The `swift` stub below is exactly that trap; `uname` says Darwin so these run anywhere.
const reportBin = path.join(scratch, 'report-bin')
mkdirSync(reportBin, { recursive: true })
writeFileSync(path.join(reportBin, 'uname'), '#!/bin/sh\nprintf Darwin\n')
chmodSync(path.join(reportBin, 'uname'), 0o755)
const REPORTING = { pathValue: `${reportBin}:/usr/bin:/bin` }
const suite = (n) => `<testsuites><testsuite name="T" ${n}></testsuite></testsuites>`
// An empty `report` writes none at all, which is a run that never got that far.
function swiftWriting(report, code = 0) {
  // `$3` is the path, because the script invokes `swift test --xunit-output <path>` — so a
  // reordering of those flags breaks this stub loudly rather than silently writing nowhere.
  // SwiftPM appends a per-harness suffix to the name asked for, and so does this.
  const write = report ? `printf '%s' '${report}' > "\${3%.xml}-swift-testing.xml"\n` : ''
  writeFileSync(path.join(reportBin, 'swift'), `#!/bin/sh\n${write}exit ${code}\n`)
  chmodSync(path.join(reportBin, 'swift'), 0o755)
}

for (const [cause, report, said] of [
  ['a failure', suite('errors="0" tests="9" failures="2"'), /2 failure\(s\) across 9/],
  ['an error', suite('errors="3" tests="9" failures="0"'), /3 failure\(s\)/],
  ['no report at all', '', /wrote no test report/],
  ['no tests', suite('errors="0" tests="0" failures="0"'), /reported 0 tests/],
]) {
  check(`swift-test.sh fails on ${cause}, though swift test exits 0`, () => {
    swiftWriting(report)
    const result = run(TEST, REPORTING)
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, said)
  })
}

check('swift-test.sh surfaces a non-zero swift exit rather than the missing report', () => {
  swiftWriting('', 3)
  const result = run(TEST, REPORTING)
  assert.equal(result.status, 3, result.output)
  assert.match(result.output, /exited 3/)
  assert.doesNotMatch(result.output, /wrote no test report/)
})

check('swift-test.sh passes on a clean report, for both packages', () => {
  swiftWriting(suite('errors="0" tests="9" failures="0"'))
  const result = run(TEST, REPORTING)
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /ArgoEngine clean, 0 failures across 9 reported tests/)
  assert.match(result.output, /ArgoUI clean, 0 failures/)
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

report('swift tooling')
