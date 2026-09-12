// The source tier of [#1769](https://github.com/milad-alizadeh/argo/issues/1769), first half: the
// CONFIGURATION a hand edit can quietly undo — the yauzl override, node-pty being a production
// dependency, the unpack glob, the fuse, the hooks, the protocol both sides of the Vite boundary
// share. None of it needs a Mac, a signing identity or a fifteen-minute package, so it runs in the
// ordinary Linux CI job on every pull request. The checks themselves are exercised against fixture
// trees next door, in `packaged-pty-fixtures.test.mjs`.
import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { FuseV1Options } from '@electron/fuses'
import { CYCLES, RESULT_PREFIX, SKIP_ENDURANCE_ENV } from './acceptance-protocol.mjs'
import { PRODUCTION_FUSE_PROFILE } from './fuse-profile.mjs'

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

describe('the root command surface', () => {
  const root = () => json(path.join(repoRoot, 'package.json'))
  const desktop = () => json(path.join(desktopRoot, 'package.json'))
  const turbo = () => json(path.join(repoRoot, 'turbo.json'))

  test('routes the release build through one uncached desktop task', () => {
    expect(root().scripts.build).toBe('turbo run build --filter=@argo/desktop')
    expect(turbo().tasks.build).toEqual({ cache: false, outputs: ['out/**'] })
    expect(desktop().scripts.build).toBe('bun run prove:pty --arch arm64')
  })

  // Forge holds the terminal for the life of the app, and so does the Storybook server, so
  // Turbo has to be told or it reports the task as one that finished. The exact shape also keeps
  // `interactive` out: under the default stream UI, turbo 2.10 refuses to start such a task at all.
  test('runs the app and Storybook as persistent tasks', () => {
    expect(root().scripts.dev).toBe('turbo run dev')
    expect(root().scripts.storybook).toBe('turbo run storybook')
    expect(turbo().tasks.dev).toEqual({ cache: false, persistent: true })
    expect(turbo().tasks.storybook).toEqual({ cache: false, persistent: true })
    expect(desktop().scripts.dev).toContain('electron-forge start')
    expect(desktop().scripts.storybook).toBe('storybook dev -p 6006')
  })

  // Without the link `electron-forge start` cannot find Electron; why is the script's own header.
  test('links the hoisted Electron before Forge starts', () => {
    const dev = desktop().scripts.dev
    // A bare index comparison would pass on a missing link script, whose -1 sorts first.
    const linked = dev.indexOf('scripts/link-hoisted-electron.mjs')
    expect(linked).toBeGreaterThan(-1)
    expect(linked).toBeLessThan(dev.indexOf('electron-forge start'))
    expect(existsSync(path.join(desktopRoot, 'scripts', 'link-hoisted-electron.mjs'))).toBe(true)
  })

  test('builds the Storybook site into its own output directory', () => {
    expect(root().scripts['build:storybook']).toBe('turbo run build:storybook')
    expect(turbo().tasks['build:storybook'].outputs).toEqual(['storybook-static/**'])
    expect(desktop().scripts['build:storybook']).toBe('storybook build')
  })
})

// `turbo.json` carries no comments, because this file parses it with `JSON.parse` and turbo's own
// tolerance for them is not shared. So the reasoning behind each cache decision lives here, next
// to the assertion that holds it.
describe('what turbo caches', () => {
  const turbo = () => json(path.join(repoRoot, 'turbo.json'))
  const cached = (task) => turbo().tasks[task].cache !== false

  // The release task packages the app and then RUNS it for 600 spawn/exit cycles. A cache entry
  // is a claim that the work need not happen, and no earlier machine's green run is evidence that
  // THIS machine's artifact starts, so the one task whose whole point is execution stays uncached.
  // The two persistent servers are uncached for the ordinary reason: they never finish.
  test('caches every task except the release proof and the two servers', () => {
    expect(cached('build')).toBe(false)
    expect(cached('dev')).toBe(false)
    expect(cached('storybook')).toBe(false)
    expect(cached('typecheck')).toBe(true)
    expect(cached('test')).toBe(true)
    expect(cached('build:storybook')).toBe(true)
  })

  // A package's default input set stops at its own directory, so these assertions — which read
  // the ROOT manifest — are invisible to the hash of the task that runs them. Without the root
  // `package.json` in `globalDependencies`, renaming a root script would be judged by a cache
  // entry that never saw the rename, and `bun run test` would report a pass for the old names.
  // `.node-version` is here because CI installs the Node every task runs on from it, and
  // `turbo.json` because the assertions in this very block read it: turbo folds in only the
  // running task's own resolved definition, so an edit to `tasks.dev` is otherwise unhashed.
  test('hashes the files that decide a task without being read by it', () => {
    expect(turbo().globalDependencies).toContain('package.json')
    expect(turbo().globalDependencies).toContain('.node-version')
    expect(turbo().globalDependencies).toContain('turbo.json')
  })

  // The renderer imports values, not only types, from `src/core` (`SHORTCUTS`, `DESTINATIONS`,
  // `APPEARANCES`), so that code lands in the built site. A hand-listed input set naming
  // `src/renderer` alone serves a stale site for a `src/core` edit.
  test('hashes the core code the built site carries', () => {
    expect(turbo().tasks['build:storybook'].inputs).toContain('src/core/**')
  })

  // `.storybook/main.ts` reads `STORYBOOK_BASE` into every asset URL. Turbo's strict env mode hands
  // a task only the variables it declares, and hashes only those, so an undeclared base is dropped
  // from the build and a root-based site can be restored for a `/argo/` one.
  test('passes and hashes the base the site is served from', () => {
    expect(turbo().tasks['build:storybook'].env).toContain('STORYBOOK_BASE')
  })

  // `tsc --noEmit` and `bun test` write nothing, and a task with no declared outputs is a task
  // whose cache entry turbo cannot describe. The empty array is the statement, not an omission.
  test('says out loud that the verdict tasks emit nothing', () => {
    expect(turbo().tasks.typecheck.outputs).toEqual([])
    expect(turbo().tasks.test.outputs).toEqual([])
  })

  // `build` is the release proof, so a `^build` edge puts a fifteen-minute package and a
  // 600-cycle app run in front of whatever declared it. Such an edge is inert only while nothing
  // depends on `@argo/desktop`; this refuses it instead of relying on that.
  test('keeps the release proof out of every other task graph', () => {
    for (const [name, task] of Object.entries(turbo().tasks))
      expect(task.dependsOn ?? [], `${name} depends on the release build`).not.toContain('^build')
  })

  // The suite reads its own fixtures, `forge.config.ts`, `package-manifest.json` and both
  // lockfiles. An input list that named them would go stale the first time a test read one more
  // file, and a stale list is a cache that serves a pass for code it never hashed. So `test`
  // narrows the default set rather than replacing it.
  test('narrows the test inputs without hand-listing them', () => {
    expect(turbo().tasks.test.inputs[0]).toBe('$TURBO_DEFAULT$')
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

  // The fuse values moved out to `fuse-profile.mjs` under #1807, so that the config and the
  // release verdict's read-back name the same nine fuses once. This asserts the value where it now
  // lives, and that the config still spreads it — a profile nothing reads is not a fuse setting.
  test('keeps OnlyLoadAppFromAsar on', () => {
    expect(PRODUCTION_FUSE_PROFILE[FuseV1Options.OnlyLoadAppFromAsar]).toBe(true)
    expect(config).toContain('...PRODUCTION_FUSE_PROFILE')
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
