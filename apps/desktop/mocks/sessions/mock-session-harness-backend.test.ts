import { expect, test } from 'bun:test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  SESSION_MOCK_ADVERSARIAL_SEED_ENV,
  SESSION_MOCK_REPLY_DELAY_MS_ENV,
} from '@/harnesses/proof-protocol'
import type {
  SessionFixture,
  SessionHarnessBackend,
  SessionHarnessRun,
} from '../../e2e/sessions/session-harness-backend'
import { CLAUDE_HISTORY_RECORDING } from '../cli/claude/recorded-claude-sessions'
import { CODEX_HISTORY_RECORDING } from '../cli/codex/recorded-codex-threads'
import { readRecordingVersion } from '../cli/recorded-calls'
import { signedInHarnessEnvironment } from '../cli/signed-in-harness'
import { createMockSessionHarnessBackend } from './mock-session-harness-backend'

const CLAUDE_SESSION_ID = '00000000-0000-4000-8000-00000000b001'

type Started = {
  root: string
  fixture: SessionFixture
  backend: SessionHarnessBackend
  run: SessionHarnessRun
}

// Each case gets its own fixture tree, removed however the case ends.
async function started(read: (start: Started) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-mock-backend-'))
  const fixture = {
    application: path.join(root, 'application'),
    claudeTranscripts: path.join(root, 'claude-config', 'projects'),
    codexTranscripts: path.join(root, 'codex-transcripts'),
    userData: path.join(root, 'userData'),
    project: path.join(root, 'project'),
  }
  const backend = createMockSessionHarnessBackend()
  try {
    await read({ root, fixture, backend, run: await backend.start({ root, fixture }) })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('hands the app an executable mock for each Harness', () =>
  started(async ({ root, run }) => {
    expect(run.executables).toEqual({
      claude: path.join(root, 'claude'),
      codex: path.join(root, 'codex'),
      'claude-acp': path.join(root, 'claude-agent-acp'),
    })
    for (const executable of Object.values(run.executables))
      expect((await stat(executable)).mode & 0o111).toBeGreaterThan(0)
  }))

test('points every transcript root at the fixture tree', () =>
  started(async ({ fixture, run }) => {
    expect(run.transcripts).toEqual({
      claude: fixture.claudeTranscripts,
      codex: fixture.codexTranscripts,
    })
  }))

test('holds the reply back only when a case asks for a slow Harness', () =>
  started(async ({ root, run }) => {
    expect(run.launchEnv({ slowReply: false })).toEqual({
      ...(await signedInHarnessEnvironment(root)),
      [SESSION_MOCK_REPLY_DELAY_MS_ENV]: '0',
    })
    const slow = run.launchEnv({ slowReply: true })[SESSION_MOCK_REPLY_DELAY_MS_ENV]
    expect(Number(slow)).toBeGreaterThan(0)
  }))

test('passes an adversarial seed to both mock CLIs', () =>
  started(async ({ run }) => {
    expect(run.launchEnv({ slowReply: false, adversarialSeed: 'replay-this' })).toMatchObject({
      [SESSION_MOCK_ADVERSARIAL_SEED_ENV]: 'replay-this',
      [SESSION_MOCK_REPLY_DELAY_MS_ENV]: '0',
    })
  }))

const ESCAPE = String.fromCharCode(27)

async function eventually(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await check()) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return false
}

// The mock `claude` writes the Turn; the Agent SDK's reader finds the reply in it.
test('reads a Claude reply the mock CLI wrote through the Agent SDK reader', () =>
  started(async ({ root, backend, run }) => {
    const reply = { harness: 'claude' as const, prompt: 'Say the word.' }
    expect(await backend.recorded(reply)).toBe(false)
    const cwd = path.join(root, 'project')
    await mkdir(cwd, { recursive: true })
    const child = spawn(run.executables.claude, ['--session-id', CLAUDE_SESSION_ID], { cwd })
    try {
      await once(child.stdout, 'data')
      child.stdin.write(`${ESCAPE}[200~${reply.prompt}${ESCAPE}[201~\r`)
      expect(await eventually(() => backend.recorded(reply))).toBe(true)
    } finally {
      child.kill()
    }
  }))

// The mock app-server keeps the Turn in the thread it answers `thread/read` with.
test('reads a Codex prompt the mock app-server took into its thread', () =>
  started(async ({ backend, run }) => {
    const reply = { harness: 'codex' as const, prompt: 'Carry on.' }
    expect(await backend.recorded(reply)).toBe(false)
    const child = spawn(run.executables.codex, [])
    const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`)
    try {
      send({ id: 1, method: 'initialize', params: {} })
      send({ id: 2, method: 'thread/start', params: { cwd: '/project' } })
      const threadId = '00000000-0000-4000-8000-000000000001'
      send({
        id: 3,
        method: 'turn/start',
        params: { threadId, input: [{ type: 'text', text: reply.prompt }] },
      })
      expect(await eventually(() => backend.recorded(reply))).toBe(true)
    } finally {
      child.kill()
    }
  }))

async function printedVersion(executable: string) {
  const child = spawn(executable, ['--version'])
  const chunks: Buffer[] = []
  child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
  await once(child, 'close')
  return Buffer.concat(chunks).toString('utf8').trim()
}

test('each mock CLI reports the version its recordings came from', () =>
  started(async ({ run }) => {
    const claude = readRecordingVersion(...CLAUDE_HISTORY_RECORDING)
    expect(await printedVersion(run.executables.claude)).toBe(`${claude} (Claude Code)`)
    const codex = readRecordingVersion(...CODEX_HISTORY_RECORDING)
    expect(await printedVersion(run.executables.codex)).toBe(`codex-cli ${codex}`)
  }))
