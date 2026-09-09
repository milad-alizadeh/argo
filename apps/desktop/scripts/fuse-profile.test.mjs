// The source tier of the fuse profile (#1757). Reading a wire off a binary needs a package, so
// what runs here is the profile itself and how a mismatch is reported.

import { describe, expect, test } from 'bun:test'
import { FuseV1Options } from '@electron/fuses'
import { fuseWireFailures, PRODUCTION_FUSE_PROFILE } from './fuse-profile.mjs'

describe('the production fuse profile', () => {
  // `strictlyRequireAllFuses` in the Forge config refuses a build that leaves one to inherit, and
  // this is the list it is matched against. An Electron upgrade that adds a fuse fails here first.
  test('names every fuse Electron has', () => {
    const all = Object.values(FuseV1Options).filter((value) => typeof value === 'number')
    expect(
      Object.keys(PRODUCTION_FUSE_PROFILE)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual(all)
  })

  test.each([
    [FuseV1Options.RunAsNode, false],
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable, false],
    [FuseV1Options.EnableNodeCliInspectArguments, false],
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, true],
    [FuseV1Options.OnlyLoadAppFromAsar, true],
  ])('closes or opens fuse %i as the profile requires', (fuse, expected) => {
    expect(PRODUCTION_FUSE_PROFILE[fuse]).toBe(expected)
  })
})

describe('reading the wire back', () => {
  test('says nothing about a wire that matches', () => {
    expect(
      fuseWireFailures([
        { fuse: 'RunAsNode', expected: false, actual: false, state: 'DISABLE', matches: true },
      ]),
    ).toEqual([])
  })

  test('names the fuse, what it reads and what it must read', () => {
    const readings = [
      { fuse: 'RunAsNode', expected: false, actual: true, state: 'ENABLE', matches: false },
    ]
    expect(fuseWireFailures(readings)).toEqual(['fuse RunAsNode reads ENABLE, expected DISABLE.'])
  })

  // A fuse left to inherit reads as neither ENABLE nor DISABLE, and that has to be a failure with
  // the state named rather than a value silently coerced to false.
  test('names a fuse that is not in the wire at all', () => {
    const readings = [
      {
        fuse: 'WasmTrapHandlers',
        expected: true,
        actual: false,
        state: 'undefined',
        matches: false,
      },
    ]
    expect(fuseWireFailures(readings)).toEqual([
      'fuse WasmTrapHandlers reads undefined, expected ENABLE.',
    ])
  })
})
