// The source tier of [#1769](https://github.com/milad-alizadeh/argo/issues/1769), second half: the
// checks themselves, run against fixture trees. A check that cannot fail is worth nothing, and only
// a deliberate violation proves it fires. The configuration half is in
// `packaged-pty-checks.test.mjs`.
import { describe, expect, test } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { archOf, extraModuleNames, nativeDirs, unpackedFailures } from './packaged-pty-checks.mjs'
import { findSpawnHelpers, restoreSpawnHelperMode, SPAWN_HELPER } from './production-install.mjs'

const desktopRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')
const read = (file) => readFileSync(file, 'utf8')

// Bun's linker decides whether node-pty hoists to the repository root or sits under apps/desktop,
// so probe both — the same rule `forgeBinary()` follows. Reading only one gives an ENOENT instead
// of a legible verdict on a tree that is perfectly fine.
function installedNodePty(...parts) {
  const roots = [desktopRoot, repoRoot].map((root) => path.join(root, 'node_modules', 'node-pty'))
  const found = roots.find((root) => existsSync(path.join(root, ...parts)))
  if (!found) throw new Error(`no installed node-pty under ${roots.join(' or ')}`)
  return path.join(found, ...parts)
}

describe('the checks themselves', () => {
  // node-pty requires the FIRST of these that holds pty.node and derives spawn-helper from that
  // same directory. If node-pty ever reorders them, an assertion written against the old order
  // checks a directory the app will not use — and still passes.
  test('nativeDirs matches node-pty s own search order', () => {
    const loader = read(installedNodePty('lib', 'utils.js'))
    // Order, not merely membership: node-pty takes the FIRST of these that holds pty.node.
    const order = /\[\s*'build\/Release'\s*,\s*'build\/Debug'\s*,\s*["']prebuilds\//.exec(loader)
    expect(order).not.toBeNull()
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

// The exec bit is one of the three silent failures this whole change exists to catch, and it is
// restored by a script that needs only a temp directory to test — so there is no reason for the
// packaged run to be the first thing that ever exercises it.
describe('restoreSpawnHelperMode', () => {
  function fixtureTree() {
    const root = mkdtempSync(path.join(tmpdir(), 'argo-install-'))
    const nested = path.join(root, 'node-pty', 'prebuilds', 'darwin-arm64')
    mkdirSync(nested, { recursive: true })
    writeFileSync(path.join(nested, SPAWN_HELPER), 'binary')
    chmodSync(path.join(nested, SPAWN_HELPER), 0o644)
    writeFileSync(path.join(nested, 'pty.node'), 'binary')
    return { root, helper: path.join(nested, SPAWN_HELPER) }
  }

  test('finds a spawn-helper nested any depth down', () => {
    const { root, helper } = fixtureTree()
    expect(findSpawnHelpers(root)).toEqual([helper])
  })

  test('turns the 0644 an install leaves into an executable file', () => {
    const { root, helper } = fixtureTree()
    expect(statSync(helper).mode & 0o111).toBe(0)
    expect(restoreSpawnHelperMode(root)).toEqual([helper])
    expect(statSync(helper).mode & 0o111).toBe(0o111)
  })

  test('reports no helpers rather than throwing on a tree that has none', () => {
    expect(restoreSpawnHelperMode(mkdtempSync(path.join(tmpdir(), 'argo-empty-')))).toEqual([])
  })

  test('a missing directory is not an error, so a caller can probe one', () => {
    expect(findSpawnHelpers(path.join(tmpdir(), 'argo-does-not-exist'))).toEqual([])
  })
})

// `prune: false` makes the production install the only thing keeping the Forge toolchain out of a
// signed app, so this is the check that notices when it stops. It reads the asar listing, where an
// `npm ci --omit=dev` leaves the emptied `@scope` DIRECTORIES of every dev package it removed —
// two dozen of them here — and counting those instead of packages fails a package that is fine.
describe('extraModuleNames', () => {
  const shipped = ['node_modules/node-pty/package.json', 'node_modules/node-pty/lib/utils.js']

  test('passes the production dependencies alone', () => {
    expect(extraModuleNames([...shipped, 'node_modules/node-addon-api/package.json'])).toEqual([])
  })

  test('ignores the empty scope directories an --omit=dev install leaves behind', () => {
    expect(extraModuleNames([...shipped, 'node_modules/@babel', 'node_modules/@electron'])).toEqual(
      [],
    )
  })

  test('names a dev package that actually shipped, scoped or not', () => {
    const entries = [
      ...shipped,
      'node_modules/@electron-forge/cli/package.json',
      'node_modules/vite/package.json',
    ]
    expect(extraModuleNames(entries)).toEqual(['@electron-forge/cli', 'vite'])
  })
})
