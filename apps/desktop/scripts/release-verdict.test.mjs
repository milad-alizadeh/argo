// The source tier of the release verdict (#1807): the updater's asset rule, the fuse and
// acceptance assertions, and what makes a whole verdict refuse to publish. The halves that read a
// signed artifact need a Mac and a certificate, and run in the release job.

import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  packagedPtyAssertion,
  signingAssertion,
  updaterAssetAssertion,
} from './release-assertions.mjs'
import { artifactDigests, verdictFailures } from './release-verdict.mjs'

function scratchFile(name, contents) {
  const filePath = path.join(mkdtempSync(path.join(tmpdir(), 'argo-verdict-')), name)
  writeFileSync(filePath, contents)
  return filePath
}

describe('the updater asset rule', () => {
  test.each([
    ['Argo-darwin-arm64-1.2.0.zip'],
    ['Argo-mac-1.2.0.zip'],
    ['Argo-osx-universal-1.2.0.zip'],
  ])('accepts %s, which update.electronjs.org will offer', (name) => {
    const assertion = updaterAssetAssertion([name, 'Argo-1.2.0-arm64.dmg', 'release-verdict.json'])
    expect(assertion.passed).toBe(true)
    expect(assertion.asset).toBe(name)
  })

  // The silent one: everything signs, everything verifies, the release publishes, and no user ever
  // receives an update.
  test('refuses a release whose ZIP the feed will not match', () => {
    const assertion = updaterAssetAssertion(['Argo-1.2.0.zip', 'Argo-1.2.0-arm64.dmg'])
    expect(assertion.passed).toBe(false)
    expect(assertion.reason).toContain('offers this release to nobody')
  })

  // The feed takes the first match in GitHub's list order, which nothing here fixes.
  test('refuses two matching ZIPs, because which one a user gets is then unspecified', () => {
    const assertion = updaterAssetAssertion([
      'Argo-darwin-arm64-1.2.0.zip',
      'Argo-darwin-x64-1.2.0.zip',
    ])
    expect(assertion.passed).toBe(false)
    expect(assertion.matches).toHaveLength(2)
  })
})

describe('the artifact hash list', () => {
  test('names every artifact by basename, size and SHA-256', () => {
    const zip = scratchFile('Argo-darwin-arm64-1.2.0.zip', 'argo')
    expect(artifactDigests([zip])).toEqual([
      {
        name: 'Argo-darwin-arm64-1.2.0.zip',
        bytes: 4,
        sha256: '774113f725e8622bcdb91dde0a36221bedf7cb2623a39f1218f17cf6ed246d19',
      },
    ])
  })

  // The list is what stops a verdict being inherited, so its order must not depend on the order
  // the workflow happened to name the files in.
  test('sorts by name', () => {
    const zip = scratchFile('Argo-darwin-arm64-1.2.0.zip', 'argo')
    const dmg = scratchFile('Argo-1.2.0-arm64.dmg', 'argo')
    expect(artifactDigests([zip, dmg]).map((artifact) => artifact.name)).toEqual([
      'Argo-1.2.0-arm64.dmg',
      'Argo-darwin-arm64-1.2.0.zip',
    ])
  })
})

describe('the packaged PTY acceptance assertion', () => {
  test('accepts an acceptance run that passed', () => {
    const outcomes = scratchFile(
      'acceptance.json',
      JSON.stringify([{ arch: 'arm64', ok: true, failures: [] }]),
    )
    expect(packagedPtyAssertion(outcomes).passed).toBe(true)
  })

  test('carries a failing run into the verdict as a failing assertion', () => {
    const outcomes = scratchFile(
      'acceptance.json',
      JSON.stringify([{ arch: 'arm64', ok: false, failures: ['exit code 1'] }]),
    )
    expect(packagedPtyAssertion(outcomes).failures).toEqual(['exit code 1'])
  })

  // A check that never ran has to be as loud as one that ran and failed.
  test('refuses an acceptance file that is not there', () => {
    const assertion = packagedPtyAssertion('/nowhere/acceptance.json')
    expect(assertion.passed).toBe(false)
    expect(assertion.failures[0]).toContain('no acceptance result')
  })

  test('refuses an acceptance file that records no run', () => {
    expect(packagedPtyAssertion(scratchFile('acceptance.json', '[]')).passed).toBe(false)
  })
})

describe('signing', () => {
  test('records signed and notarized as explicit booleans', () => {
    expect(signingAssertion({ signed: true, notarized: true }).passed).toBe(true)
  })

  // A fork pull request receives no secrets, so it produces a different verdict rather than an
  // absent one, and the release path refuses it here.
  test('refuses a build that could not sign', () => {
    const assertion = signingAssertion({ signed: false, notarized: false })
    expect(assertion.passed).toBe(false)
    expect(assertion.failures).toEqual([
      'the app carries no Developer ID signature',
      'the app carries no stapled notarization ticket',
    ])
  })
})

describe('what refuses a publish', () => {
  const passing = {
    assertions: {
      signing: { name: 'signing', passed: true, failures: [] },
      fuses: { name: 'fuses', passed: true, failures: [] },
    },
  }

  test('publishes when every assertion passes', () => {
    expect(verdictFailures(passing)).toEqual([])
  })

  test('names the assertion that refused it', () => {
    const failing = {
      assertions: {
        ...passing.assertions,
        fuses: {
          name: 'fuses',
          passed: false,
          failures: ['fuse RunAsNode reads ENABLE, expected DISABLE.'],
        },
      },
    }
    expect(verdictFailures(failing)).toEqual([
      'fuses: fuse RunAsNode reads ENABLE, expected DISABLE.',
    ])
  })

  // An assertion that reports a reason rather than a list still has to reach the publish gate.
  test('carries an assertion that failed with a reason and no failure list', () => {
    const failing = {
      assertions: {
        updaterAsset: { name: 'updaterAsset', passed: false, reason: 'no asset matches' },
      },
    }
    expect(verdictFailures(failing)).toEqual(['updaterAsset: no asset matches'])
  })
})
