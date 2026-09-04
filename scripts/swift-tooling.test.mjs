#!/usr/bin/env node
// Tests for the Swift lint, format and test entrypoints, run via `bun run test:hooks`.
// `build.sh` has its own file beside this one; both share `swift-tooling.harness.mjs`.
//
// They all skip when the toolchain is absent, which is right on a Linux runner and on a
// TypeScript-only contributor's machine — and catastrophic in the macOS CI job, where a
// missing binary would report Success without checking a line. `ARGO_REQUIRE_SWIFT_TOOLS`
// is what turns each skip into a failure; these tests are the proof it does.
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { check, report } from './check-harness.mjs'
import { ARGV_LOG, BARE, MISSING, run, STRICT, STUBBED, scratch } from './swift-tooling.harness.mjs'

const LINT = 'scripts/swift-lint.sh'
const FORMAT = 'scripts/swift-format.sh'
const TEST = 'apps/macOS/scripts/swift-test.sh'
// The package loop `swift-test.sh` spells, in its order. The first is asserted by name in the
// configuration case below and the rest by their verdict lines, so this list is the one place
// the count and the order live.
const PACKAGES = ['ArgoEngine', 'ArgoUI', 'ArgoMermaid', 'ArgoAtlas']

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
  // `$3` is the path, because the script invokes `swift test --xunit-output <path>` ahead of
  // any configuration flags — so a reordering of those breaks this stub loudly rather than
  // silently writing nowhere. SwiftPM appends a per-harness suffix to the name asked for, and
  // so does this. The argv line is what lets a test assert on the flags themselves.
  const write = report ? `printf '%s' '${report}' > "\${3%.xml}-swift-testing.xml"\n` : ''
  const head = `#!/bin/sh\nprintf '%s\\n' "$@" >> '${ARGV_LOG}'\n`
  writeFileSync(path.join(reportBin, 'swift'), `${head}${write}exit ${code}\n`)
  chmodSync(path.join(reportBin, 'swift'), 0o755)
}

for (const [cause, reportXml, said] of [
  ['a failure', suite('errors="0" tests="9" failures="2"'), /2 failure\(s\) across 9/],
  ['an error', suite('errors="3" tests="9" failures="0"'), /3 failure\(s\)/],
  ['no report at all', '', /wrote no test report/],
  ['no tests', suite('errors="0" tests="0" failures="0"'), /reported 0 tests/],
]) {
  check(`swift-test.sh fails on ${cause}, though swift test exits 0`, () => {
    swiftWriting(reportXml)
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

// The debug row also stands for the default: no `ARGO_TEST_CONFIGURATION` in the environment
// at all, and the script adds no configuration flag of its own.
//
// `-DDEBUG` in the release row is not decoration. Every counter ADR-0028's budgets read is
// `#if DEBUG`, so without it the test target does not COMPILE in release (#991) — and a count
// is the same either side of `-O`, so it is the seconds a release run re-records.
for (const [configuration, environment, flags] of [
  ['debug', {}, []],
  ['release', { ARGO_TEST_CONFIGURATION: 'release' }, ['-c', 'release', '-Xswiftc', '-DDEBUG']],
]) {
  check(`swift-test.sh runs ${configuration} on a clean report, for every package`, () => {
    swiftWriting(suite('errors="0" tests="9" failures="0"'))
    const result = run(TEST, { ...REPORTING, env: environment })
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, new RegExp(`${PACKAGES[0]} \\(${configuration}\\)`))
    for (const name of PACKAGES.slice(1)) {
      assert.match(result.output, new RegExp(`${name} clean, 0 failures across 9 reported tests`))
    }
    // Every invocation in order: the report path, then whatever flags the configuration adds.
    // One per package in the loop — a package added to the script and not to `PACKAGES` would be
    // a run nobody counted.
    const passed = result.argv.filter((arg) => arg !== 'test' && !arg.endsWith('.xml'))
    assert.deepEqual(
      passed,
      PACKAGES.flatMap(() => ['--xunit-output', ...flags]),
    )
  })
}

check('swift-test.sh refuses a configuration it does not carry', () => {
  swiftWriting(suite('errors="0" tests="9" failures="0"'))
  const result = run(TEST, { ...REPORTING, env: { ARGO_TEST_CONFIGURATION: 'fastest' } })
  assert.equal(result.status, 1, result.output)
  assert.match(result.output, /debug or release/)
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
