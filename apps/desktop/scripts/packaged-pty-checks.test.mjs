// The source tier of [#1769](https://github.com/milad-alizadeh/argo/issues/1769): everything
// about the packaged PTY that can be judged without a Mac, a signing identity or a fifteen-minute
// package. It runs in the ordinary Linux CI job, on every pull request.
//
// Two kinds of thing live here. The first is the configuration a hand edit can quietly undo —
// the yauzl override, node-pty being a PRODUCTION dependency, the unpack glob, the fuse, the
// hooks. The second is the checks themselves, exercised against fixture trees, because a check
// that cannot fail is worth nothing and only a deliberate violation proves it fires.
import { describe, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { archOf, nativeDirs, unpackedFailures } from './packaged-pty-checks.mjs'

const here = import.meta.dirname
const desktopRoot = path.resolve(here, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')

const read = (file) => readFileSync(file, 'utf8')
const json = (file) => JSON.parse(read(file))

describe('the tree Forge is given', () => {
  // `--omit=dev` is what keeps the production install small. A node-pty that drifted into
  // devDependencies would be omitted by exactly the flag that makes the install worth doing, and
  // the app would package, sign and ship with no PTY.
  test('node-pty is a production dependency of apps/desktop', () => {
    const manifest = json(path.join(desktopRoot, 'package.json'))
    expect(manifest.dependencies['node-pty']).toBeString()
    expect(manifest.devDependencies?.['node-pty']).toBeUndefined()
  })

  // The second lockfile is the cost #1791 accepted. Its whole value is being the same answer as
  // package.json, so a bump in one and not the other is the failure to catch.
  test('the second lockfile pins the same node-pty as the manifest', () => {
    const manifest = json(path.join(desktopRoot, 'package.json'))
    const lock = json(path.join(desktopRoot, 'package-lock.json'))
    expect(lock.packages['node_modules/node-pty'].version).toBe(manifest.dependencies['node-pty'])
    expect(lock.packages['node_modules/node-pty'].dev).toBeUndefined()
  })

  // The endurance half of the #1749 boundary is a version gate on node-pty, and nothing but a
  // measurement says so. Measured on this repo's arm64 Mac, 600 spawn/exit cycles of `/bin/sh -c
  // 'exit 0'` with the exit awaited each time, descriptors counted with lsof:
  //
  //   node-pty 1.1.0 (`latest`)       FAILED at cycle 497, `posix_spawnp failed.`, +1492 fds
  //   node-pty 1.2.0-beta.15 (`beta`) 600/600, +0 fds
  //
  // Three descriptors per terminal, one of them a `/dev/ptmx`, and `kill()` and `destroy()` change
  // nothing — the read stream is destroyed but the CustomWriteStream over the SAME fd is not.
  // `kern.tty.ptmx_max` is 511 on macOS, so on 1.1.0 a cockpit process can open about 500 PTYs in
  // its whole lifetime however cleanly each one is closed. That is a hard ceiling on the thing
  // #1791 chose node-pty to be, so the `beta` tag is the version that ships until the fix reaches
  // `latest`. Downgrading to 1.1.0 turns the packaged endurance check red; this says why before
  // anyone reads that as flake.
  test('node-pty is pinned to the line whose descriptors stay flat', () => {
    const manifest = json(path.join(desktopRoot, 'package.json'))
    expect(manifest.dependencies['node-pty']).toStartWith('1.2.0-beta.')
  })

  // forge#4277: Forge's `extract-zip` pulls a yauzl@2 that is broken on Node 24.16 and later, and
  // the symptom is not an error — Forge extracts one file of the Electron zip and hangs with an
  // empty `out`. The repo pins Node 24.20.0 (#1751), so the override is the only thing between
  // this app and that hang.
  test('yauzl is overridden to 3.3.1 at the repository root', () => {
    const root = json(path.join(repoRoot, 'package.json'))
    expect(root.overrides.yauzl).toBe('3.3.1')
    expect(read(path.join(repoRoot, 'bun.lock'))).toContain('"yauzl": ["yauzl@3.3.1"')
  })
})

describe('forge.config.ts', () => {
  const config = read(path.join(desktopRoot, 'forge.config.ts'))

  // AutoUnpackNativesPlugin only knows `**/*.node`, and `spawn-helper` has no extension. Under
  // the plugin alone the helper stays inside the archive, node-pty's `app.asar.unpacked` rewrite
  // points at nothing, and every spawn fails silently.
  test('unpacks the whole node-pty module, not just its .node files', () => {
    expect(config).toContain("'**/node_modules/node-pty/**'")
  })

  test('keeps OnlyLoadAppFromAsar on', () => {
    expect(config).toContain('[FuseV1Options.OnlyLoadAppFromAsar]: true')
  })

  // The checks are only a gate while they are on the path every artifact takes.
  test('wires the production install and the packaged assertion as hooks', () => {
    expect(config).toContain('prePackage')
    expect(config).toContain('productionInstall()')
    expect(config).toContain('postPackage')
    expect(config).toContain('assertPackagedPty(')
  })
})

describe('the checks themselves', () => {
  // node-pty requires the FIRST of these that holds pty.node and derives spawn-helper from that
  // same directory. If node-pty ever reorders them, an assertion written against the old order
  // checks a directory the app will not use — and still passes.
  test('nativeDirs matches node-pty s own search order', () => {
    const loader = read(path.join(repoRoot, 'node_modules', 'node-pty', 'lib', 'utils.js'))
    expect(loader).toContain("['build/Release', 'build/Debug', \"prebuilds/\"")
    expect(nativeDirs('arm64')).toEqual(['build/Release', 'build/Debug', 'prebuilds/darwin-arm64'])
  })

  test('archOf reads the architecture out of Forge s output directory name', () => {
    expect(archOf('/x/out/Argo-darwin-arm64')).toBe('arm64')
    expect(archOf('/x/out/Argo-darwin-arm64/')).toBe('arm64')
    expect(archOf('/x/out/Argo-linux-x64')).toBeNull()
  })
})

// Fixture trees, so each failure mode is proved to fail rather than assumed to.
function fixtureApp(mode) {
  const appPath = path.join(mkdtempSync(path.join(tmpdir(), 'argo-pty-')), 'Argo.app')
  const dir = path.join(
    appPath,
    'Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64',
  )
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'pty.node'), 'binary')
  if (mode !== 'no-helper') {
    writeFileSync(path.join(dir, 'spawn-helper'), 'binary')
    chmodSync(path.join(dir, 'spawn-helper'), mode === 'bad-mode' ? 0o644 : 0o755)
  }
  return appPath
}

describe('unpackedFailures', () => {
  const chosen = 'prebuilds/darwin-arm64'

  test('passes a complete, executable pair', () => {
    expect(unpackedFailures(fixtureApp('good'), chosen)).toEqual([])
  })

  test('fails a spawn-helper that lost its executable bit', () => {
    const failures = unpackedFailures(fixtureApp('bad-mode'), chosen)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('mode 644')
  })

  test('fails a spawn-helper that was left inside the asar', () => {
    const failures = unpackedFailures(fixtureApp('no-helper'), chosen)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('is not an unpacked file')
  })

  // The trap that makes replicating node-pty's search order worth doing: `@electron/rebuild` can
  // leave a build/Release that wins the search and holds no helper.
  test('fails when the chosen directory is not the one that was unpacked', () => {
    const failures = unpackedFailures(fixtureApp('good'), 'build/Release')
    expect(failures).toHaveLength(2)
  })
})
