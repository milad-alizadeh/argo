// The fixtures behind `step-cache.test.mjs`: a repository holding the real Swift entrypoints,
// with stubs for the two commands that cost minutes.
//
// The scripts are copied in rather than pointed at, and the repository is real, because the
// thing under test reads HEAD: a fixture that only pretended to be a checkout could not tell a
// committed tree from a dirty one, which is the distinction the whole cache turns on.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const PACKAGES = ['ArgoEngine', 'ArgoUI', 'ArgoMermaid', 'ArgoAtlas']

export const REPORT_XML = (name) =>
  `<?xml version="1.0"?><testsuites><testsuite name="${name}" tests="9" failures="0" errors="0"></testsuite></testsuites>`

// The `swift` stub writes the report `verdict` reads and records the package it was asked for,
// which it takes from the working directory — where swift-test.sh puts it.
const SWIFT_STUB = (log) => `#!/bin/sh
if [ "$1" = "--version" ]; then echo "\${STUB_SWIFT_VERSION:-6.2.0}"; exit 0; fi
pkg=\${PWD##*/}
echo "$pkg" >> ${JSON.stringify(log)}
out=""
while [ $# -gt 0 ]; do
  if [ "$1" = "--xunit-output" ]; then out=$2; fi
  shift
done
[ -n "$out" ] && printf '%s\\n' "$STUB_REPORT" > "$out"
exit 0
`

// The tree the entrypoints read: the real scripts, and one source file per package.
function seed(dir) {
  mkdirSync(path.join(dir, 'apps/macOS/scripts'), { recursive: true })
  mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  for (const file of [
    'apps/macOS/scripts/swift-test.sh',
    'scripts/swift-tool-guard.sh',
    'scripts/gate-cache.sh',
    'scripts/metrics.sh',
  ]) {
    writeFileSync(path.join(dir, file), readFileSync(path.join(ROOT, file), 'utf8'))
  }
  for (const pkg of PACKAGES) {
    mkdirSync(path.join(dir, 'apps/macOS/Packages', pkg), { recursive: true })
    writeFileSync(path.join(dir, 'apps/macOS/Packages', pkg, 'source.swift'), 'let a = 1\n')
  }
}

export function scenario() {
  const dir = mkdtempSync(path.join(tmpdir(), 'step-cache-'))
  const vcs = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe', encoding: 'utf8' })
  vcs('init', '-q', '-b', 'main')
  vcs('config', 'user.email', 'test@example.com')
  vcs('config', 'user.name', 'test')
  seed(dir)
  vcs('add', '-A')
  vcs('commit', '-qm', 'seed')

  const bin = path.join(dir, 'bin')
  mkdirSync(bin, { recursive: true })
  const ranLog = path.join(dir, 'swift.log')
  writeFileSync(path.join(bin, 'swift'), SWIFT_STUB(ranLog))
  // `uname` says Darwin, so these cases run on the Linux CI too. Without it `swift-test.sh`
  // takes its "not macOS" skip and every assertion about what ran sees nothing having run —
  // green on this machine, eight failures on the runner.
  writeFileSync(path.join(bin, 'uname'), '#!/bin/sh\necho Darwin\n')
  execFileSync('chmod', ['+x', path.join(bin, 'swift'), path.join(bin, 'uname')])

  const run = (args = [], env = {}) => {
    const result = spawnSync('sh', [path.join(dir, 'apps/macOS/scripts/swift-test.sh'), ...args], {
      cwd: path.join(dir, 'apps/macOS'),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:/usr/bin:/bin`,
        ARGO_GATE_CACHE_DIR: path.join(dir, 'cache'),
        // The metrics file goes with the fixture. A suite appending to the machine's own
        // record would put stub timings in the report a person reads.
        ARGO_METRICS_FILE: path.join(dir, 'metrics.tsv'),
        STUB_REPORT: REPORT_XML('passing'),
        ...env,
      },
    })
    return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
  }
  const ran = () => {
    try {
      return readFileSync(ranLog, 'utf8').trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
  return {
    dir,
    bin,
    run,
    ran,
    vcs,
    commit: (file, body) => {
      writeFileSync(path.join(dir, file), body)
      vcs('add', '-A')
      vcs('commit', '-qm', 'edit')
    },
    write: (file, body) => writeFileSync(path.join(dir, file), body),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

// A build's product is an app, not a verdict, and `worktree-gc --artifacts` deletes those by
// design — so this fixture can take the app away and leave the verdict behind.
export function buildScenario() {
  const s = scenario()
  writeFileSync(
    path.join(s.dir, 'apps/macOS/scripts/build.sh'),
    readFileSync(path.join(ROOT, 'apps/macOS/scripts/build.sh'), 'utf8'),
  )
  const product = path.join(s.dir, 'apps/macOS/build/Build/Products/Debug/Argo.app')
  const log = path.join(s.dir, 'xcodebuild.log')
  writeFileSync(
    path.join(s.bin, 'xcodebuild'),
    `#!/bin/sh\necho built >> ${JSON.stringify(log)}\nmkdir -p ${JSON.stringify(product)}\n`,
  )
  writeFileSync(path.join(s.bin, 'security'), '#!/bin/sh\nexit 1\n')
  execFileSync('chmod', ['+x', path.join(s.bin, 'xcodebuild'), path.join(s.bin, 'security')])
  s.vcs('add', '-A')
  s.vcs('commit', '-qm', 'build script')
  return {
    ...s,
    product,
    builds: () => {
      try {
        return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).length
      } catch {
        return 0
      }
    },
    build: (env = {}) =>
      spawnSync('sh', [path.join(s.dir, 'apps/macOS/scripts/build.sh')], {
        cwd: path.join(s.dir, 'apps/macOS'),
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${s.bin}:/usr/bin:/bin`,
          ARGO_GATE_CACHE_DIR: path.join(s.dir, 'cache'),
          ARGO_METRICS_FILE: path.join(s.dir, 'metrics.tsv'),
          ...env,
        },
      }),
  }
}
