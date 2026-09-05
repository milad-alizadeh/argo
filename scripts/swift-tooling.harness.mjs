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
    // The verdict cache OFF. These suites run the real entrypoints against the real repository
    // (`cwd` is REPO_ROOT), and what they assert is the command each one INVOKES — so a
    // recorded pass from an earlier real run would answer for the stub and the argv log would
    // be empty (#1377). Whether the cache itself is sound is `step-cache.test.mjs`'s question.
    env: { PATH: pathValue, HOME: process.env.HOME, ARGO_GATE_CACHE: 'off', ...env },
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
  // `gate-cache.sh` and `metrics.sh` join the two the guard needs because swift-lint.sh sources
  // them now (#1377), and a `.` of a file that is not there aborts before the config is read.
  for (const file of ['swift-lint.sh', 'swift-tool-guard.sh', 'gate-cache.sh', 'metrics.sh']) {
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

// `swift test` EXITS 0 ON A FAILED RUN (#918), so `swift-test.sh` may believe only the xUnit
// report. The `swift` stub below is exactly that trap; `uname` says Darwin so these run anywhere.
//
// Shared for the same reason `run` is: the narrow-run tests split into their own file at the
// 150-line ceiling and needed the identical stub, and a second copy of it is a second thing to
// keep true.
const reportBin = path.join(scratch, 'report-bin')
mkdirSync(reportBin, { recursive: true })
writeFileSync(path.join(reportBin, 'uname'), '#!/bin/sh\nprintf Darwin\n')
chmodSync(path.join(reportBin, 'uname'), 0o755)
export const REPORTING = { pathValue: `${reportBin}:/usr/bin:/bin` }
export const suite = (n) => `<testsuites><testsuite name="T" ${n}></testsuite></testsuites>`

// An empty `report` writes none at all, which is a run that never got that far.
export function swiftWriting(report, code = 0) {
  // `$3` is the path, because the script invokes `swift test --xunit-output <path>` ahead of
  // any configuration flags — so a reordering of those breaks this stub loudly rather than
  // silently writing nowhere. SwiftPM appends a per-harness suffix to the name asked for, and
  // so does this. The argv line is what lets a test assert on the flags themselves.
  const write = report ? `printf '%s' '${report}' > "\${3%.xml}-swift-testing.xml"\n` : ''
  const head = `#!/bin/sh\nprintf '%s\\n' "$@" >> '${ARGV_LOG}'\n`
  writeFileSync(path.join(reportBin, 'swift'), `${head}${write}exit ${code}\n`)
  chmodSync(path.join(reportBin, 'swift'), 0o755)
}

// The package loop `swift-test.sh` spells, in its order — asserted by name in the configuration
// cases and by verdict line elsewhere, so this list is the one place the count and order live.
export const PACKAGES = ['ArgoEngine', 'ArgoUI', 'ArgoMermaid', 'ArgoAtlas']
