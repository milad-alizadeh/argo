// The source tier of [#1769](https://github.com/milad-alizadeh/argo/issues/1769), first half: the
// CONFIGURATION a hand edit can quietly undo — the yauzl override, node-pty being a production
// dependency, the unpack glob, the fuse, the hooks, the protocol both sides of the Vite boundary
// share. None of it needs a Mac, a signing identity or a fifteen-minute package, so it runs in the
// ordinary Linux CI job on every pull request. The checks themselves are exercised against fixture
// trees next door, in `packaged-pty-fixtures.test.mjs`.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { CYCLES, RESULT_PREFIX, SKIP_ENDURANCE_ENV } from './acceptance-protocol.mjs'

const desktopRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')

const read = (file) => readFileSync(file, 'utf8')
const json = (file) => JSON.parse(read(file))

// Both ends of the app-to-driver protocol, across the Vite bundling boundary.
const PROTOCOL_USERS = [
  'src/main.ts',
  'src/pty-acceptance.ts',
  'scripts/prove-packaged-pty.mjs',
  'scripts/packaged-app.mjs',
]

// A prerelease sorts BELOW its release under semver — 1.2.0-beta.15 < 1.2.0 — so the numeric
// triple is compared and the prerelease suffix ignored. Both are acceptable here: the fix landed
// in the 1.2.0 line and every build of it carries the fix.
function atLeastVersion(version, floor) {
  const parts = version.split('-')[0].split('.').map(Number)
  for (const [index, minimum] of floor.entries()) {
    if (parts[index] > minimum) return true
    if (parts[index] < minimum) return false
  }
  return true
}

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

  // node-pty leaks three descriptors per terminal before 1.2.0, against a 511 ptmx ceiling on
  // macOS, so the packaged endurance check cannot pass on an older one. The measurement and the
  // cause are in apps/desktop/README.md; this is the floor, expressed so that the upgrade the
  // README describes — beta to stable — needs no edit here. A prefix match on `1.2.0-beta.` would
  // have turned 1.2.0 final red on the day it shipped.
  test('node-pty is at or above the release whose descriptors stay flat', () => {
    const manifest = json(path.join(desktopRoot, 'package.json'))
    expect(atLeastVersion(manifest.dependencies['node-pty'], [1, 2, 0])).toBe(true)
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

// The app is bundled by Vite out of src/ and the driver runs as plain node out of scripts/, so the
// two never share a module at runtime. They share one at build time, and these assert that shape
// reached both sides: a silent rename makes the driver report "the app printed no
// ARGO_PTY_ACCEPTANCE line; node-pty may have failed to load" — naming the one thing that is fine.
describe('the app-to-driver protocol', () => {
  test('the prefix is a prefix, and both sides take it from one place', () => {
    expect(RESULT_PREFIX).toBe('ARGO_PTY_ACCEPTANCE ')
    expect(RESULT_PREFIX.endsWith(' ')).toBe(true)
  })

  test('nothing in src or scripts spells a protocol string by hand', () => {
    for (const file of PROTOCOL_USERS) {
      const source = read(path.join(desktopRoot, file)).replaceAll(/^\s*\/\/.*$/gm, '')
      expect(source).not.toContain(`'${SKIP_ENDURANCE_ENV}'`)
      expect(source).not.toContain(`'${RESULT_PREFIX}'`)
    }
  })

  // The number IS the assertion: node-pty 1.1.0 dies around cycle 497 against a 511 ptmx ceiling,
  // so a run that quietly did fewer has not tested the thing #1749 asked for.
  test('the cycle count is the one #1749 names', () => {
    expect(CYCLES).toBe(600)
  })
})
