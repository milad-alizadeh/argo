import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fakeClaudeFolder } from '../../../agents/claude/session-fake-driver/fake-claude-transcripts'
import { SESSION_FAKE_REPLY_DELAY_MS_ENV } from '../proof-protocol'
import { createFakeSessionCliBackend } from './fake-session-cli-backend'

async function startBackend() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-fake-backend-'))
  const fixture = {
    application: path.join(root, 'application'),
    claudeTranscripts: path.join(root, 'claude-transcripts'),
    codexTranscripts: path.join(root, 'codex-transcripts'),
    archive: path.join(root, 'archive'),
    userData: path.join(root, 'userData'),
    project: path.join(root, 'project'),
  }
  const backend = createFakeSessionCliBackend()
  return { root, fixture, backend, run: await backend.start({ root, fixture }) }
}

test('hands the app an executable fake for each CLI', async () => {
  const { root, run } = await startBackend()
  expect(run.executables).toEqual({
    claude: path.join(root, 'claude'),
    codex: path.join(root, 'codex'),
  })
  for (const executable of Object.values(run.executables))
    expect((await stat(executable)).mode & 0o111).toBeGreaterThan(0)
  await rm(root, { recursive: true, force: true })
})

test('points every transcript root at the fixture tree', async () => {
  const { root, fixture, run } = await startBackend()
  expect(run.transcripts).toEqual({
    claude: fixture.claudeTranscripts,
    codex: fixture.codexTranscripts,
    archive: fixture.archive,
  })
  await rm(root, { recursive: true, force: true })
})

test('holds the reply back only when a case asks for a slow CLI', async () => {
  const { root, run } = await startBackend()
  expect(run.launchEnv({ slowReply: false })).toEqual({ [SESSION_FAKE_REPLY_DELAY_MS_ENV]: '0' })
  const slow = run.launchEnv({ slowReply: true })[SESSION_FAKE_REPLY_DELAY_MS_ENV]
  expect(Number(slow)).toBeGreaterThan(0)
  await rm(root, { recursive: true, force: true })
})

test('reads a recorded Claude reply out of the transcript the fake wrote', async () => {
  const { root, fixture, backend } = await startBackend()
  const reply = { cli: 'claude' as const, prompt: 'Say the word.' }
  expect(await backend.recorded(reply)).toBe(false)
  const folder = fakeClaudeFolder(fixture.claudeTranscripts)
  await mkdir(folder, { recursive: true })
  await writeFile(path.join(folder, 'one.jsonl'), 'Fake Claude read: Say the word.\n')
  expect(await backend.recorded(reply)).toBe(true)
  await rm(root, { recursive: true, force: true })
})

test('reads a recorded Codex turn out of the nested rollout tree', async () => {
  const { root, fixture, backend } = await startBackend()
  const reply = { cli: 'codex' as const, prompt: 'Carry on.' }
  expect(await backend.recorded(reply)).toBe(false)
  const day = path.join(fixture.codexTranscripts, '2026', '09', '14')
  await mkdir(day, { recursive: true })
  await writeFile(path.join(day, 'rollout-one.jsonl'), '{"message":"Carry on."}\n')
  expect(await backend.recorded(reply)).toBe(true)
  await rm(root, { recursive: true, force: true })
})
