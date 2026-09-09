// Reading release notes out of the committed changelog (#1807). Writing them is `/release-argo`'s
// job (#1808); this is the half that decides whether a version may be released at all.
import { describe, expect, test } from 'bun:test'
import { changelogEntry } from './changelog-entry.mjs'

const CHANGELOG = `# Argo desktop

## 1.2.0 — 2026-09-09

- The Feed settles its geometry before it draws.
- Sessions resume after a restart.

## 1.1.0

- The first packaged release.
`

describe('reading an entry', () => {
  test('returns the body of the version asked for', () => {
    expect(changelogEntry(CHANGELOG, '1.2.0')).toBe(
      '- The Feed settles its geometry before it draws.\n- Sessions resume after a restart.',
    )
  })

  test('stops at the next version heading', () => {
    expect(changelogEntry(CHANGELOG, '1.1.0')).toBe('- The first packaged release.')
  })

  // The release stops here, before anything is built, rather than publishing a release with no
  // notes on it.
  test('has no entry for a version nobody wrote up', () => {
    expect(changelogEntry(CHANGELOG, '1.3.0')).toBeNull()
  })

  test('has no entry for a heading with nothing under it', () => {
    expect(changelogEntry('## 1.2.0\n\n## 1.1.0\n\n- something\n', '1.2.0')).toBeNull()
  })

  // A prefix match would hand `1.2.1` the notes for `1.2.10`.
  test('does not take a longer version for the one asked for', () => {
    expect(changelogEntry('## 1.2.10\n\n- ten\n', '1.2.1')).toBeNull()
  })

  test('reads a heading that carries a date', () => {
    expect(changelogEntry('## 1.2.0 — 2026-09-09\n\n- dated\n', '1.2.0')).toBe('- dated')
  })
})
