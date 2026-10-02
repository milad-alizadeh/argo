import { expect, test } from 'bun:test'
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fixtureLines, fixturePath, writeFixtureTree } from './mock-transcript-files'

const FIXTURE_FOLDER = path.join('mocks', 'cli', 'claude', 'fixtures', 'sessions')
const RECORDED_CWD = /"cwd":\s*"([^"]+)"/

// Some fixtures record no cwd at all, and the writer rejects those.
async function namesWithCwd() {
  const names: string[] = []
  for (const entry of await readdir(FIXTURE_FOLDER)) {
    if (!entry.endsWith('.jsonl')) continue
    const name = entry.slice(0, -'.jsonl'.length)
    if (RECORDED_CWD.test((await fixtureLines(name)).join('\n'))) names.push(name)
  }
  return names
}

test('every working folder a fixture Session records exists after the tree is written', async () => {
  const names = await namesWithCwd()
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-fixture-tree-'))
  try {
    const transcripts = path.join(root, 'claude-config', 'projects')
    await writeFixtureTree(transcripts, names)
    for (const name of names) {
      const written = await readFile(fixturePath(transcripts, name), 'utf8')
      const cwd = RECORDED_CWD.exec(written)?.[1]
      if (cwd === undefined) throw new Error(`The written ${name} transcript records no cwd.`)
      expect((await stat(cwd)).isDirectory(), cwd).toBe(true)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
