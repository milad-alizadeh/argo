import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { writeMockCodexLive } from '../cli/codex/mock-codex-cli'
import { loadRecording } from './recording'

test('rejects an untagged recording with the file and missing metadata field', () => {
  expect(() => loadRecording('codex-app-server/0.157.0/model-list.json', { data: [] })).toThrow(
    /model-list.json.*producer/,
  )
})

test('rejects a producer or version that disagrees with the recording folder', () => {
  const tagged = {
    producer: 'codex-app-server',
    version: '0.157.0',
    recordedAt: '2026-10-01',
    payload: { data: [] },
  }
  expect(() => loadRecording('codex-app-server/0.147.0/model-list.json', tagged)).toThrow(
    /model-list.json.*version/,
  )
  expect(() => loadRecording('claude-cli/0.157.0/model-list.json', tagged)).toThrow(
    /model-list.json.*producer/,
  )
})

test('accepts a tagged legacy recording with an unknown capture date', () => {
  const tagged = {
    producer: 'codex-app-server',
    version: '0.157.0',
    recordedAt: null,
    payload: { data: [{ id: 'recorded-model' }] },
  }
  expect(loadRecording('codex-app-server/0.157.0/model-list.json', tagged)).toBe(tagged)
})

test('requires a capture date field even when the legacy date is unknown', () => {
  expect(() =>
    loadRecording('claude-cli/2.1.286/history.json', {
      producer: 'claude-cli',
      version: '2.1.286',
      payload: [],
    }),
  ).toThrow(/history.json.*recordedAt/)
})

test('reports the recording folder version through the mock Codex CLI', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-recording-version-'))
  try {
    const executable = await writeMockCodexLive(directory)
    const folders = await readdir('mocks/recordings/codex-app-server')
    expect(folders).toHaveLength(1)
    expect(execFileSync(executable, ['--version'], { encoding: 'utf8' }).trim()).toBe(
      `codex-cli ${folders[0]}`,
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
