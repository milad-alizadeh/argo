import { expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { isolatedLaunchEnvironment } from './harness-home'

const e2eRoot = path.join(import.meta.dir, '..', 'e2e')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name)
    if (statSync(file).isDirectory()) return sourceFiles(file)
    return file.endsWith('.ts') ? [file] : []
  })
}

test('a launch environment gives each Harness an empty temp home, not the host one', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'launch-environment-'))
  const environment = await isolatedLaunchEnvironment(root)
  expect(environment.CLAUDE_CONFIG_DIR?.startsWith(root)).toBe(true)
  expect(environment.CODEX_HOME?.startsWith(root)).toBe(true)
  expect(readdirSync(environment.CLAUDE_CONFIG_DIR as string)).toEqual([])
})

// A launch that spreads the host environment hands the app the machine's own `~/.claude` (#2974).
test('no e2e file that launches the app spreads the host environment', () => {
  const offenders = sourceFiles(e2eRoot).filter((file) => {
    const source = readFileSync(file, 'utf8')
    return /\b(?:electron\.launch|spawn)\(/.test(source) && source.includes('...process.env')
  })
  expect(offenders.map((file) => path.relative(e2eRoot, file))).toEqual([])
})
