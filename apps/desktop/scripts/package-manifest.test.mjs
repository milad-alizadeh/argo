// The source tier of [#1806](https://github.com/milad-alizadeh/argo/issues/1806), first half: the
// normalisation rule, the schema and the comparison, none of which needs a package. The half that
// reads a built app is in `package-manifest-fixtures.test.mjs`.
import { describe, expect, test } from 'bun:test'
import {
  MANIFEST_PATH,
  manifestDifferences,
  manifestSchemaFailures,
  normalisedEntry,
  readCheckedInManifest,
  SECTIONS,
} from './package-manifest.mjs'

describe('normalising an entry', () => {
  test('collapses a content hash in the Vite output', () => {
    expect(normalisedEntry('.vite/build/main-CCc-4WXs.js')).toBe('.vite/build/main-[hash].js')
    expect(normalisedEntry('/.vite/renderer/main_window/assets/index-BdPmnemx.js')).toBe(
      '/.vite/renderer/main_window/assets/index-[hash].js',
    )
  })

  test('leaves an unhashed Vite entry alone', () => {
    expect(normalisedEntry('.vite/build/preload.js')).toBe('.vite/build/preload.js')
    expect(normalisedEntry('.vite/renderer/main_window/index.html')).toBe(
      '.vite/renderer/main_window/index.html',
    )
  })

  // node_modules compares literally, because that is where an unwanted file actually arrives. A
  // module whose own filename looks hashed must not be collapsed into one the manifest cannot
  // tell apart from another.
  test('leaves a node_modules path literal even when it looks hashed', () => {
    expect(normalisedEntry('node_modules/node-pty/lib/chunk-AbCdEfG1.js')).toBe(
      'node_modules/node-pty/lib/chunk-AbCdEfG1.js',
    )
  })
})

describe('the manifest schema', () => {
  const valid = { asar: ['a'], unpacked: [], extraResources: [] }

  test.each(SECTIONS)('refuses a manifest with no %s array', (section) => {
    const missing = { ...valid }
    delete missing[section]
    expect(manifestSchemaFailures(missing)).toEqual([`the manifest has no \`${section}\` array`])
  })

  test('refuses an entry that is not a string', () => {
    expect(manifestSchemaFailures({ ...valid, unpacked: [7] })).toEqual([
      '`unpacked` holds an entry that is not a string',
    ])
  })

  test('refuses an array the comparison would never read', () => {
    expect(manifestSchemaFailures({ ...valid, sourcemaps: [] })).toEqual([
      '`sourcemaps` is not one of the three named arrays',
    ])
  })

  test('refuses a manifest that is not an object', () => {
    expect(manifestSchemaFailures([])).toEqual(['the manifest is not a JSON object'])
  })

  test('accepts the checked-in manifest', () => {
    expect(readCheckedInManifest(MANIFEST_PATH).failures).toEqual([])
  })

  // CI reads this manifest off a darwin-x64 package on Linux and off the shipped darwin-arm64 one
  // on macOS, and both compare against this one file. That only holds while every architecture
  // named in it is named in both halves — which is what `DROPPED_FROM_PACKAGE` in forge.config.ts
  // delivers today, keeping both darwin prebuilds whatever architecture is asked for. Narrow it to
  // the built architecture and the Linux tier starts failing on a package that is perfectly fine.
  test.each(SECTIONS)('names both darwin architectures or neither in %s', (section) => {
    const entries = readCheckedInManifest(MANIFEST_PATH).manifest[section]
    const partners = { 'darwin-arm64': 'darwin-x64', 'darwin-x64': 'darwin-arm64' }
    for (const entry of entries)
      for (const [architecture, partner] of Object.entries(partners))
        if (entry.includes(architecture))
          expect(entries).toContain(entry.replace(architecture, partner))
  })
})

describe('comparing a package against the manifest', () => {
  const empty = { asar: [], unpacked: [], extraResources: [] }

  test.each(SECTIONS)('reports a file the manifest does not name in %s', (section) => {
    const actual = { ...empty, [section]: ['sourcemap.js.map'] }
    expect(manifestDifferences(empty, actual)).toEqual([`${section} +sourcemap.js.map`])
  })

  test.each(SECTIONS)('reports a file the manifest names that left %s', (section) => {
    const expected = { ...empty, [section]: ['pty.node'] }
    expect(manifestDifferences(expected, empty)).toEqual([`${section} -pty.node`])
  })

  test('passes when the two sets are equal', () => {
    const manifest = { asar: ['package.json'], unpacked: ['pty.node'], extraResources: ['a.icns'] }
    expect(manifestDifferences(manifest, { ...manifest })).toEqual([])
  })
})
