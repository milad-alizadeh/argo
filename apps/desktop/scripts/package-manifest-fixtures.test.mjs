// The source tier of [#1806](https://github.com/milad-alizadeh/argo/issues/1806), second half:
// the reading and the assertion, against a real asar built here. A gate proved by an exit code 0
// is a gate proved by nothing, so the assertion cases inject a difference and read the refusal.
// The rules it applies are next door, in `package-manifest.test.mjs`.
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import asar from '@electron/asar'
import { packageManifestAssertion, readPackagedManifest } from './package-manifest.mjs'

const UNPACKED_PTY = ['app.asar.unpacked', 'node_modules', 'node-pty']

// A packaged app in miniature: an asar built for real from a source tree, the unpacked files
// beside it, one extra resource, and an empty `.lproj` of the kind Electron leaves in Resources.
// Building the asar rather than faking its entry list is what makes `readPackagedManifest` answer
// the same question here as it does in CI.
async function fixtureApp() {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-manifest-'))
  const source = path.join(root, 'source')
  const resources = path.join(root, 'Argo.app', 'Contents', 'Resources')
  mkdirSync(path.join(source, '.vite', 'build'), { recursive: true })
  mkdirSync(path.join(resources, ...UNPACKED_PTY), { recursive: true })
  mkdirSync(path.join(resources, 'en.lproj'), { recursive: true })
  writeFileSync(path.join(source, 'package.json'), '{}\n')
  writeFileSync(path.join(source, '.vite', 'build', 'main-AbCdEfG1.js'), 'main\n')
  writeFileSync(path.join(resources, ...UNPACKED_PTY, 'pty.node'), '')
  writeFileSync(path.join(resources, 'electron.icns'), 'icon\n')
  await asar.createPackage(source, path.join(resources, 'app.asar'))
  return {
    appPath: path.join(root, 'Argo.app'),
    resources,
    // The manifest a passing comparison would be made against, written beside the app so the
    // checked-in one is never the thing a fixture case reads.
    manifestPath: path.join(root, 'manifest.json'),
    dispose: () => rmSync(root, { recursive: true, force: true }),
  }
}

async function fixtureWithItsOwnManifest() {
  const fixture = await fixtureApp()
  writeFileSync(fixture.manifestPath, JSON.stringify(readPackagedManifest(fixture.appPath)))
  return fixture
}

describe('reading a packaged app', () => {
  // An empty `en.lproj` contributes nothing: a directory that ships no file is not a difference,
  // and the file inside one would be listed under its own name.
  test('reads the three arrays off the package', async () => {
    const fixture = await fixtureApp()
    try {
      expect(readPackagedManifest(fixture.appPath)).toEqual({
        asar: ['.vite', '.vite/build', '.vite/build/main-[hash].js', 'package.json'],
        unpacked: ['node_modules/node-pty/pty.node'],
        extraResources: ['electron.icns'],
      })
    } finally {
      fixture.dispose()
    }
  })

  test('refuses an app with no Contents/Resources', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'argo-manifest-'))
    try {
      expect(() => readPackagedManifest(path.join(root, 'Argo.app'))).toThrow('nothing was read')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('the assertion the release verdict carries', () => {
  test('passes when the package matches its manifest', async () => {
    const fixture = await fixtureWithItsOwnManifest()
    try {
      expect(packageManifestAssertion(fixture.appPath, fixture.manifestPath)).toEqual({
        name: 'packageManifest',
        passed: true,
        appPath: fixture.appPath,
        differences: [],
      })
    } finally {
      fixture.dispose()
    }
  })

  // The injection the ticket asks for: a file nobody named arrives in the package, and the
  // assertion has to go red for it rather than exit 0 having looked at the manifest alone.
  test('fails on a file injected after the manifest was written', async () => {
    const fixture = await fixtureWithItsOwnManifest()
    try {
      writeFileSync(path.join(fixture.resources, 'signing-receipt.plist'), 'injected\n')
      const assertion = packageManifestAssertion(fixture.appPath, fixture.manifestPath)
      expect(assertion.passed).toBe(false)
      expect(assertion.differences).toEqual(['extraResources +signing-receipt.plist'])
    } finally {
      fixture.dispose()
    }
  })

  test('fails on a file the manifest names that left the package', async () => {
    const fixture = await fixtureWithItsOwnManifest()
    try {
      rmSync(path.join(fixture.resources, ...UNPACKED_PTY, 'pty.node'))
      const assertion = packageManifestAssertion(fixture.appPath, fixture.manifestPath)
      expect(assertion.passed).toBe(false)
      expect(assertion.differences).toEqual(['unpacked -node_modules/node-pty/pty.node'])
    } finally {
      fixture.dispose()
    }
  })

  // The case the ticket's cited `outputPaths.length === 0` guard exists for: nothing was packaged.
  // It has to leave the same record as a package that read wrong, not a stack trace and no
  // assertion at all.
  test('fails when the package cannot be read', async () => {
    const fixture = await fixtureWithItsOwnManifest()
    try {
      rmSync(fixture.resources, { recursive: true })
      const assertion = packageManifestAssertion(fixture.appPath, fixture.manifestPath)
      expect(assertion.passed).toBe(false)
      expect(assertion.differences[0]).toContain('nothing was read')
    } finally {
      fixture.dispose()
    }
  })

  test('fails when the manifest itself cannot be read', async () => {
    const fixture = await fixtureApp()
    try {
      const assertion = packageManifestAssertion(fixture.appPath, fixture.manifestPath)
      expect(assertion.passed).toBe(false)
      expect(assertion.differences[0]).toContain('could not be read')
    } finally {
      fixture.dispose()
    }
  })
})
