import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { transcriptPaths } from './transcript-files'

test('returns no Claude transcripts when a profile has no transcript root', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-transcripts-'))
  const missingRoot = path.join(directory, 'missing')
  try {
    expect(await transcriptPaths(missingRoot)).toEqual([])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('reports transcript roots that exist but cannot be read as directories', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-transcripts-'))
  const file = path.join(directory, 'not-a-directory')
  try {
    await writeFile(file, '')
    await expect(transcriptPaths(file)).rejects.toThrow()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
