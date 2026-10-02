import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { mockCodexStateFile } from '../cli/codex/mock-codex-cli'
import { writeCodexThreads } from './mock-codex-thread-files'

test('every working folder a Codex fixture thread records exists after the threads are written', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-fixture-'))
  try {
    await writeCodexThreads(root, path.join(root, 'codex-home', 'sessions'))
    const threads: { cwd: string }[] = JSON.parse(await readFile(mockCodexStateFile(root), 'utf8'))
    expect(threads.length).toBeGreaterThan(0)
    for (const { cwd } of threads) expect((await stat(cwd)).isDirectory(), cwd).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
