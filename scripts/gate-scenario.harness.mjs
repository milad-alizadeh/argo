// A throwaway repository for the push gate's suites, shared by `swift-gate.test.mjs` and
// `gate-cache.test.mjs` rather than written twice.
//
// It is a real git repository with one commit on `main` and one on a branch, the gate scripts
// copied in, and stubs for the two commands the gate shells out to. Both stubs record what they
// were asked for, which is what every case in both suites actually reads: the gate's own output
// says what it MEANT to do, and the logs say what it did.
//
// The lock root and the cache directory are per scenario, deliberately. A suite that took one of
// the machine's real build slots would wait on whatever lane is compiling, and one that recorded
// passes into the machine's real verdict cache would tell the next push it had already been
// gated.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The gate and everything it reaches for. Copied rather than stubbed, so a scenario runs the
// real ones: the lock takes a slot under the scenario's own root, and the scope answers ALL
// because a scenario has no packages directory to read.
const GATE_SCRIPTS = ['swift-gate.sh', 'build-lock.sh', 'swift-scope.sh', 'gate-cache.sh']

function writeAll(dir, files) {
  for (const [file, body] of Object.entries(files)) {
    const target = path.join(dir, file)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
}

// The two commands the gate shells out to. `bun` runs its three steps; `swift` is asked only
// for its version, which is part of the verdict key.
function stubs(dir) {
  const bin = path.join(dir, 'bin')
  mkdirSync(bin, { recursive: true })
  const log = path.join(dir, 'bun.log')
  writeFileSync(
    path.join(bin, 'bun'),
    `#!/bin/sh\necho "$@" >> ${JSON.stringify(log)}\nexit \${STUB_BUN_STATUS:-0}\n`,
  )
  writeFileSync(path.join(bin, 'swift'), `#!/bin/sh\necho "\${STUB_SWIFT_VERSION:-6.2.0}"\n`)
  execFileSync('chmod', ['+x', path.join(bin, 'bun'), path.join(bin, 'swift')])
  return { bin, log }
}

// One commit on `main` carrying the seed and the gate scripts, one on `work` carrying the
// change. `origin/main` is what the gate falls back to for a base; a remote-tracking ref is
// enough for that.
function history(dir, git, { seed, change }) {
  writeAll(dir, seed)
  writeAll(
    dir,
    Object.fromEntries(
      GATE_SCRIPTS.map((s) => [
        `scripts/${s}`,
        readFileSync(path.join(ROOT, 'scripts', s), 'utf8'),
      ]),
    ),
  )
  git('add', '-A')
  git('commit', '-qm', 'seed')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  git('checkout', '-qb', 'work')
  writeAll(dir, change)
  git('add', '-A')
  git('commit', '-qm', 'change')
}

export function gateScenario({ seed = { 'seed.txt': 'seed\n' }, change = {} } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'swift-gate-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe', encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'test')
  history(dir, git, { seed, change })

  const { bin, log } = stubs(dir)
  const run = (env = {}) => {
    try {
      const output = execFileSync('sh', ['scripts/swift-gate.sh'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          ARGO_BUILD_LOCK_ROOT: path.join(dir, 'lock'),
          ARGO_GATE_CACHE_DIR: path.join(dir, 'gate-cache'),
          ...env,
        },
      })
      return { status: 0, output }
    } catch (err) {
      return { status: err.status, output: `${err.stdout ?? ''}${err.stderr ?? ''}` }
    }
  }
  const ran = () => {
    try {
      return readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
  return {
    dir,
    run,
    ran,
    commands: () => ran().length,
    commit: (file, body) => {
      writeAll(dir, { [file]: body })
      git('add', '-A')
      git('commit', '-qm', 'edit')
    },
    write: (file, body) => writeAll(dir, { [file]: body }),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}
