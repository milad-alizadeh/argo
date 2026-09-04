// The fixture behind `land.test.mjs`: a real local repository with one PR to land.
//
// `origin` is a bare repository, `clone` is the checkout `land.sh` runs from, and `main` has
// moved on since the branch was cut — which is the whole situation the landing lane exists for.
// Only `gh` and the gate are stubbed: the merge is the one step that cannot be exercised for
// real, and the gate is the one that would cost minutes.
//
// `conflicting: true` makes the branch and `main` touch the same file, so the rebase fails the
// way a real one does rather than by being told to.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The gate, stubbed inside the repository CONTENT — which is where land.sh reads it from,
// deliberately: the gate that runs is the one on the branch being landed.
const GATE_STUB = `#!/bin/sh\necho "gate ran" >> "$STUB_GATE_LOG"\nexit \${STUB_GATE_STATUS:-0}\n`

// Only the four questions land.sh asks of `gh`, and a log of everything it was asked.
const ghStub = (log) => `#!/bin/sh
echo "$@" >> ${JSON.stringify(log)}
case "$1 $2" in
  "repo view") echo main ;;
  "pr list") echo 1 ;;
  "pr view")
    case "$*" in
      *headRefName*) echo feature ;;
      *state*) echo OPEN ;;
      *) echo "" ;;
    esac
    ;;
  "pr merge") exit \${STUB_MERGE_STATUS:-0} ;;
esac
exit 0
`

function seed(clone, git, conflicting) {
  mkdirSync(path.join(clone, 'scripts'), { recursive: true })
  writeFileSync(path.join(clone, 'scripts/swift-gate.sh'), GATE_STUB)
  for (const script of ['land.sh', 'build-lock.sh']) {
    writeFileSync(
      path.join(clone, 'scripts', script),
      readFileSync(path.join(ROOT, 'scripts', script), 'utf8'),
    )
  }
  writeFileSync(path.join(clone, 'shared.txt'), 'base\n')
  git(clone, 'add', '-A')
  git(clone, 'commit', '-qm', 'seed')
  git(clone, 'push', '-q', 'origin', 'main')

  git(clone, 'checkout', '-qb', 'feature')
  writeFileSync(path.join(clone, conflicting ? 'shared.txt' : 'feature.txt'), 'branch\n')
  git(clone, 'add', '-A')
  git(clone, 'commit', '-qm', 'the work')
  git(clone, 'push', '-q', '-u', 'origin', 'feature')

  // main moves on, as it does about ninety times a day.
  git(clone, 'checkout', '-q', 'main')
  writeFileSync(path.join(clone, conflicting ? 'shared.txt' : 'other.txt'), 'moved on\n')
  git(clone, 'add', '-A')
  git(clone, 'commit', '-qm', 'somebody else landed')
  git(clone, 'push', '-q', 'origin', 'main')
}

export function landScenario({ conflicting = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'land-'))
  const origin = path.join(dir, 'origin.git')
  const clone = path.join(dir, 'clone')
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' })

  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin])
  // stdio piped: cloning an empty repository is a warning, and a suite's output should be its
  // own cases, not git's.
  execFileSync('git', ['clone', '-q', origin, clone], { stdio: 'pipe' })
  git(clone, 'config', 'user.email', 'test@example.com')
  git(clone, 'config', 'user.name', 'test')
  seed(clone, git, conflicting)

  const bin = path.join(dir, 'bin')
  mkdirSync(bin, { recursive: true })
  const ghLog = path.join(dir, 'gh.log')
  writeFileSync(path.join(bin, 'gh'), ghStub(ghLog))
  execFileSync('chmod', ['+x', path.join(bin, 'gh')])

  const gateLog = path.join(dir, 'gate.log')
  // spawnSync, not execFileSync: land.sh reports what it REFUSED to do on stderr, and those
  // lines are what most of the cases are asserting on.
  const run = (args, env = {}) => {
    const result = spawnSync('sh', [path.join(clone, 'scripts/land.sh'), ...args], {
      cwd: clone,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        STUB_GATE_LOG: gateLog,
        ARGO_LAND_LOCK_ROOT: path.join(dir, 'land-lock'),
        ...env,
      },
    })
    return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
  }
  const read = (file) => {
    try {
      return readFileSync(file, 'utf8')
    } catch {
      return ''
    }
  }
  return {
    dir,
    clone,
    origin,
    run,
    git,
    gh: () => read(ghLog),
    gated: () => (existsSync(gateLog) ? read(gateLog).trim().split('\n').length : 0),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}
