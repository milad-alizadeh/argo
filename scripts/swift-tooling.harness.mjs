// The stub PATHs the Swift entrypoint tests run their scripts against, shared by
// `swift-tooling.test.mjs` and `swift-build.test.mjs`.
//
// Shared rather than copied because there are four entrypoints now and one file for all of them
// sat on the 150-line ceiling (#998) — and because a second copy of `run` is a second thing to
// keep true.
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
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

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The tools live in Homebrew's prefix, so a PATH of the system directories alone is a
// faithful "not installed" — except for `swift`, which Xcode shims into /usr/bin. Hiding
// that one needs a PATH holding nothing but the handful of binaries the scripts call.
export const scratch = mkdtempSync(path.join(tmpdir(), 'argo-swift-tooling-'))
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
//
// Exported because a test that writes a stub of its OWN — `swift`, made to answer with a report
// the real one would not — has to append to the log `run` reads, or the argv it asserts on is
// empty.
export const ARGV_LOG = path.join(scratch, 'argv.log')
export function stub(name) {
  const file = path.join(stubBin, name)
  writeFileSync(file, `#!/bin/sh\nprintf '%s\\n' "$@" >> '${ARGV_LOG}'\n`)
  chmodSync(file, 0o755)
}
// `security` among them: stubbed, it finds no identity, so build.sh takes its unsigned branch —
// the branch CI takes, and the one whose argv the build tests are about.
for (const tool of ['swiftformat', 'swiftlint', 'swift', 'xcodebuild', 'security']) {
  stub(tool)
}

// `cwd` defaults to the real repo, which is what every test about a script's ARGV wants. A test
// about what a script REFUSES needs a tree it may write in, so it passes a scratch one instead.
export function run(script, { args = [], env = {}, pathValue, cwd = REPO_ROOT }) {
  rmSync(ARGV_LOG, { force: true })
  // /bin/sh by absolute path: the bare PATH deliberately holds no shell.
  const result = spawnSync('/bin/sh', [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: { PATH: pathValue, HOME: process.env.HOME, ...env },
  })
  const argv = existsSync(ARGV_LOG) ? readFileSync(ARGV_LOG, 'utf8').trim().split('\n') : []
  return { ...result, argv, output: `${result.stdout}${result.stderr}` }
}

// A scratch repo holding just what swift-lint.sh reads before it runs: the configs whose contents
// decide whether it refuses, and copies of the scripts themselves. Written rather than pointed at
// the real tree because these tests are about what a DIFFERENT config would do. `runner` names the
// file the invocation goes in, so a test can put it anywhere the guard is meant to look.
export function treeDeclaring({ analyzerRules = true, runner = null, invocation = '' } = {}) {
  const root = mkdtempSync(path.join(scratch, 'lint-config-'))
  mkdirSync(path.join(root, 'apps/macOS'), { recursive: true })
  mkdirSync(path.join(root, '.github/workflows'), { recursive: true })
  mkdirSync(path.join(root, 'scripts'), { recursive: true })
  for (const file of ['swift-lint.sh', 'swift-tool-guard.sh']) {
    copyFileSync(path.join(REPO_ROOT, 'scripts', file), path.join(root, 'scripts', file))
  }
  const rules = analyzerRules ? 'analyzer_rules:\n  - unused_import\n' : ''
  writeFileSync(
    path.join(root, 'apps/macOS/.swiftlint.yml'),
    `${rules}line_length:\n  error: 100\n`,
  )
  writeFileSync(path.join(root, 'package.json'), '{"scripts":{"quality:swift":"swiftlint lint"}}')
  if (runner) {
    writeFileSync(path.join(root, runner), invocation)
  }
  return root
}

// A PATH with none of the tools on it, and one with the stubs first.
export const MISSING = { pathValue: '/usr/bin:/bin' }
export const STUBBED = { pathValue: `${stubBin}:/usr/bin:/bin` }
// The bare PATH trips whichever of a script's two guards comes first: on Linux the `uname`
// check, on macOS the missing `swift`. Either way the posture under test is the same.
export const BARE = { pathValue: bareBin }
export const STRICT = { ARGO_REQUIRE_SWIFT_TOOLS: '1' }
