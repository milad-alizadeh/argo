import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createRealSessionCliBackend,
  prepareRealSessionHome,
  resolveRealSessionExecutables,
} from './real-session-cli-backend'
import type { SessionFixture } from './session-cli-backend'

async function inTemporaryRoot(read: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-real-backend-'))
  try {
    await read(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function writeSubscriptionCredentials(root: string) {
  const sourceHome = path.join(root, 'source-home')
  await mkdir(path.join(sourceHome, '.codex'), { recursive: true })
  await writeFile(path.join(sourceHome, '.claude.json'), 'claude-token')
  await writeFile(path.join(sourceHome, '.codex', 'auth.json'), 'codex-token')
  return sourceHome
}

async function startedRealBackend(root: string) {
  const backend = createRealSessionCliBackend({
    findExecutable: (name) => `/bin/${name}`,
    home: await writeSubscriptionCredentials(root),
    verifyAuthentication: () => undefined,
  })
  return { backend, run: await backend.start({ root, fixture: {} as SessionFixture }) }
}

test('resolves both real CLIs before it starts the packaged app', () => {
  expect(
    resolveRealSessionExecutables((name) => ({ claude: '/bin/claude', codex: '/bin/codex' })[name]),
  ).toEqual({ claude: '/bin/claude', codex: '/bin/codex' })
})

test('names the missing CLI in the setup error', () => {
  expect(() =>
    resolveRealSessionExecutables((name) => (name === 'claude' ? '/bin/claude' : null)),
  ).toThrow('codex is not available on PATH')
})

test('copies both subscription credentials into an isolated HOME', async () =>
  inTemporaryRoot(async (root) => {
    const sourceHome = await writeSubscriptionCredentials(root)

    const home = await prepareRealSessionHome(path.join(root, 'run'), sourceHome)

    expect(home).toBe(path.join(root, 'run', 'home'))
    expect(await readFile(path.join(home, '.claude.json'), 'utf8')).toBe('claude-token')
    expect(await readFile(path.join(home, '.codex', 'auth.json'), 'utf8')).toBe('codex-token')
  }))

test('names authentication when a subscription credential is absent', async () =>
  inTemporaryRoot(async (root) => {
    const sourceHome = path.join(root, 'source-home')
    await mkdir(sourceHome)

    await expect(prepareRealSessionHome(path.join(root, 'run'), sourceHome)).rejects.toThrow(
      'Claude authentication is unavailable',
    )
  }))

test('leaves transcript roots unset and launches under its isolated HOME', async () =>
  inTemporaryRoot(async (root) => {
    const { run } = await startedRealBackend(root)

    expect(run.executables).toEqual({ claude: '/bin/claude', codex: '/bin/codex' })
    expect(run.transcripts).toBeNull()
    expect(run.launchEnv({ slowReply: false }).HOME).toBe(path.join(root, 'home'))
  }))

test('recognizes an assistant record after the prompt in a real Claude transcript', async () =>
  inTemporaryRoot(async (root) => {
    const { backend, run } = await startedRealBackend(root)
    const transcript = path.join(
      run.launchEnv({ slowReply: false }).HOME,
      '.claude',
      'projects',
      'run.jsonl',
    )
    await mkdir(path.dirname(transcript), { recursive: true })
    await writeFile(
      transcript,
      `${JSON.stringify({ type: 'user', uuid: 'user', message: { content: 'Reply with ACK.' } })}\n${JSON.stringify({ type: 'assistant', uuid: 'assistant', message: { content: 'ACK' } })}\n`,
    )

    expect(await backend.recorded({ cli: 'claude', prompt: 'Reply with ACK.' })).toBe(true)
  }))
