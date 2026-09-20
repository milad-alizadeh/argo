// The mock CLI check against fixture bundles, so a mock that reaches the package is proved to fail (#2324).
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import asar from '@electron/asar'
import {
  MOCK_CLAUDE_PROCESS_TITLE,
  MOCK_CODEX_PROCESS_TITLE,
} from '../mocks/cli/mock-cli-process-titles.mts'
import { mockCliFailures } from './packaged-mock-cli-checks.mts'

async function fixtureApp({
  bundled = '',
  unpacked = '',
  copied = null,
}: {
  bundled?: string
  unpacked?: string
  copied?: string | null
} = {}): Promise<string> {
  const root = mkdtempSync(path.join(tmpdir(), 'argo-mock-cli-'))
  const source = path.join(root, 'app')
  mkdirSync(path.join(source, '.vite', 'build'), { recursive: true })
  writeFileSync(path.join(source, '.vite', 'build', 'main.js'), `console.log('argo')\n${bundled}`)
  if (copied) {
    mkdirSync(path.dirname(path.join(source, copied)), { recursive: true })
    writeFileSync(path.join(source, copied), 'process.title = MOCK_CLAUDE_PROCESS_TITLE\n')
  }
  const resources = path.join(root, 'Argo.app', 'Contents', 'Resources')
  mkdirSync(path.join(resources, 'app.asar.unpacked', 'node_modules', 'node-pty'), {
    recursive: true,
  })
  writeFileSync(
    path.join(resources, 'app.asar.unpacked', 'node_modules', 'node-pty', 'index.js'),
    unpacked,
  )
  await asar.createPackage(source, path.join(resources, 'app.asar'))
  return path.join(root, 'Argo.app')
}

describe('mockCliFailures', () => {
  test('passes a bundle that holds no mock CLI', async () => {
    expect(mockCliFailures(await fixtureApp())).toEqual([])
  })

  test.each([
    ['claude', MOCK_CLAUDE_PROCESS_TITLE],
    ['codex', MOCK_CODEX_PROCESS_TITLE],
  ])('fails a bundle whose main script carries the mock %s CLI', async (cli, title) => {
    const failures = mockCliFailures(await fixtureApp({ bundled: `process.title = '${title}'` }))
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain(`mock ${cli} CLI`)
    expect(failures[0]).toContain('.vite/build/main.js')
  })

  test('fails a mock CLI source copied into the archive under its own path', async () => {
    const failures = mockCliFailures(
      await fixtureApp({ copied: 'mocks/cli/claude/mock-claude.ts' }),
    )
    expect(failures).toEqual([
      'a mock CLI file is in the package, at app.asar/mocks/cli/claude/mock-claude.ts',
    ])
  })

  test('fails a mock CLI left in the unpacked files', async () => {
    const failures = mockCliFailures(await fixtureApp({ unpacked: MOCK_CODEX_PROCESS_TITLE }))
    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('app.asar.unpacked')
  })
})
