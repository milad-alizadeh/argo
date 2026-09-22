import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { recordTurn, rememberThreadCwd } from './mock-codex-transcript.ts'

test('a recorded Codex Turn keeps the folder thread/start named', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'argo-codex-transcript-'))
  const previous = process.env.ARGO_CODEX_TRANSCRIPTS
  process.env.ARGO_CODEX_TRANSCRIPTS = root
  try {
    rememberThreadCwd('thread-1', '/project/argo')
    recordTurn('thread-1', 'Open the Codex resume proof.')
    const transcript = await readFile(
      path.join(root, '2026', '09', '14', 'rollout-2026-09-14T15-17-11-thread-1.jsonl'),
      'utf8',
    )
    const meta = JSON.parse(transcript.split('\n')[0] ?? '') as { payload?: { cwd?: string } }
    assert.equal(meta.payload?.cwd, '/project/argo')
  } finally {
    if (previous === undefined) delete process.env.ARGO_CODEX_TRANSCRIPTS
    else process.env.ARGO_CODEX_TRANSCRIPTS = previous
    await rm(root, { recursive: true, force: true })
  }
})
