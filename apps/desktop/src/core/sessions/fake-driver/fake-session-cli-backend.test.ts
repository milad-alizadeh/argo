import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fakeClaudeCli } from '../../../agents/claude/session-fake-driver/fake-claude-cli'
import { fakeCodexCli } from '../../../agents/codex/session-fake-driver/fake-codex-cli'
import { SESSION_FAKE_REPLY_DELAY_MS_ENV } from '../proof-protocol'
import { createFakeSessionCliBackend } from './fake-session-cli-backend'
import type { SessionCliBackend, SessionCliRun, SessionFixture } from './session-cli-backend'

type Started = {
  root: string
  fixture: SessionFixture
  backend: SessionCliBackend
  run: SessionCliRun
}

// Each case gets its own fixture tree, removed however the case ends.
async function started(read: (start: Started) => Promise<void>) {
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
  try {
    await read({ root, fixture, backend, run: await backend.start({ root, fixture }) })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('hands the app an executable fake for each CLI', () =>
  started(async ({ root, run }) => {
    expect(run.executables).toEqual({
      claude: path.join(root, 'claude'),
      codex: path.join(root, 'codex'),
    })
    for (const executable of Object.values(run.executables))
      expect((await stat(executable)).mode & 0o111).toBeGreaterThan(0)
  }))

test('points every transcript root at the fixture tree', () =>
  started(async ({ fixture, run }) => {
    expect(run.transcripts).toEqual({
      claude: fixture.claudeTranscripts,
      codex: fixture.codexTranscripts,
      archive: fixture.archive,
    })
  }))

test('holds the reply back only when a case asks for a slow CLI', () =>
  started(async ({ run }) => {
    expect(run.launchEnv({ slowReply: false })).toEqual({ [SESSION_FAKE_REPLY_DELAY_MS_ENV]: '0' })
    const slow = run.launchEnv({ slowReply: true })[SESSION_FAKE_REPLY_DELAY_MS_ENV]
    expect(Number(slow)).toBeGreaterThan(0)
  }))

test('reads a recorded Claude reply out of the transcript the fake wrote', () =>
  started(async ({ fixture, backend }) => {
    const reply = { cli: 'claude' as const, prompt: 'Say the word.' }
    expect(await backend.recorded(reply)).toBe(false)
    const folder = fakeClaudeCli.folder(fixture.claudeTranscripts)
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, 'one.jsonl'), `${fakeClaudeCli.replyMark(reply.prompt)}\n`)
    expect(await backend.recorded(reply)).toBe(true)
  }))

// Codex nests its rollouts under dated folders, so the reading walks the whole tree.
test('reads a recorded Codex turn out of a nested transcript tree', () =>
  started(async ({ fixture, backend }) => {
    const reply = { cli: 'codex' as const, prompt: 'Carry on.' }
    expect(await backend.recorded(reply)).toBe(false)
    const nested = path.join(fakeCodexCli.folder(fixture.codexTranscripts), 'one', 'two', 'three')
    await mkdir(nested, { recursive: true })
    await writeFile(
      path.join(nested, 'rollout-one.jsonl'),
      `{"message":"${fakeCodexCli.replyMark(reply.prompt)}"}\n`,
    )
    expect(await backend.recorded(reply)).toBe(true)
  }))
