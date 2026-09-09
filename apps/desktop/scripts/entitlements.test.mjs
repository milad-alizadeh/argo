// The source tier of the entitlement set (#1771): which plist a path takes, and what a read-back
// then has to find on it. The half that runs `codesign` needs a signed package and a Mac, so it
// lives in the artifact tier.
import { describe, expect, test } from 'bun:test'
import {
  ALLOW_JIT,
  entitlementKeysFor,
  entitlementsPlistFor,
  entitlementsProfileFor,
} from './entitlements.mjs'
import { entitlementFailures } from './signing-readback.mjs'

const APP = '/tmp/out/Argo-darwin-arm64/Argo.app'
const FRAMEWORKS = `${APP}/Contents/Frameworks`

describe('which entitlements a signed path takes', () => {
  test.each([
    [`${APP}`],
    [`${APP}/Contents/MacOS/Argo`],
    [`${FRAMEWORKS}/Argo Helper.app`],
    [`${FRAMEWORKS}/Argo Helper.app/Contents/MacOS/Argo Helper`],
    [`${FRAMEWORKS}/Argo Helper (GPU).app`],
    [`${FRAMEWORKS}/Argo Helper (Renderer).app`],
  ])('gives allow-jit to %s, which runs V8', (filePath) => {
    expect(entitlementsProfileFor(filePath, 'Argo')).toBe('allow-jit')
    expect(entitlementKeysFor(filePath, 'Argo')).toEqual([ALLOW_JIT])
  })

  // The plugin helper is reachable only through `allowLoadingUnsignedLibraries`, which Argo does
  // not set. Its bundle name contains the plain helper's name, so order decides this one.
  test('gives the plugin helper nothing', () => {
    expect(entitlementsProfileFor(`${FRAMEWORKS}/Argo Helper (Plugin).app`, 'Argo')).toBe('none')
  })

  test.each([
    [`${FRAMEWORKS}/Electron Framework.framework/Versions/A/Helpers/chrome_crashpad_handler`],
    [`${FRAMEWORKS}/Squirrel.framework/Versions/A/Resources/ShipIt`],
    [
      `${APP}/Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/spawn-helper`,
    ],
    [`${APP}/Contents/Resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node`],
    [`${FRAMEWORKS}/Electron Framework.framework`],
    [`${FRAMEWORKS}/libffmpeg.dylib`],
    [`${APP}/Contents/Resources/app.asar`],
  ])('gives %s nothing', (filePath) => {
    expect(entitlementsProfileFor(filePath, 'Argo')).toBe('none')
    expect(entitlementKeysFor(filePath, 'Argo')).toEqual([])
  })

  // A path with no answer takes @electron/osx-sign's own default plist, which is the widening the
  // whole set exists to stop, so the function has to be total over anything the walk yields.
  test('answers for a path nobody anticipated', () => {
    expect(entitlementsPlistFor(`${APP}/Contents/Resources/something-new`, 'Argo')).toBe(
      'assets/entitlements/none.plist',
    )
  })

  test('reads the app name from its argument rather than assuming Argo', () => {
    expect(entitlementsProfileFor('/tmp/Cockpit.app/Contents/MacOS/Cockpit', 'Cockpit')).toBe(
      'allow-jit',
    )
    expect(entitlementsProfileFor('/tmp/Cockpit.app/Contents/MacOS/Cockpit', 'Argo')).toBe('none')
  })
})

describe('reading the entitlements back', () => {
  test('accepts a reading that matches what the path is allowed', () => {
    expect(
      entitlementFailures([
        { path: 'Argo.app', granted: [ALLOW_JIT], allowed: [ALLOW_JIT], matches: true },
      ]),
    ).toEqual([])
  })

  test('refuses an extra key', () => {
    const readings = [
      {
        path: 'Argo.app',
        granted: [ALLOW_JIT, 'com.apple.security.device.camera'],
        allowed: [ALLOW_JIT],
        matches: false,
      },
    ]
    expect(entitlementFailures(readings)).toEqual([
      'Argo.app carries [com.apple.security.cs.allow-jit, com.apple.security.device.camera], ' +
        'and #1771 allows [com.apple.security.cs.allow-jit].',
    ])
  })

  // The expensive silent one: a process that runs V8 without allow-jit still launches.
  test('refuses a missing key', () => {
    const readings = [{ path: 'Argo.app', granted: [], allowed: [ALLOW_JIT], matches: false }]
    expect(entitlementFailures(readings)).toEqual([
      'Argo.app carries [], and #1771 allows [com.apple.security.cs.allow-jit].',
    ])
  })
})
