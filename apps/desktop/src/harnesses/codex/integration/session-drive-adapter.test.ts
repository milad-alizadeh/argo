import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CodexSessionDriverError } from '@/harnesses/codex/drive/codex-session-error.ts'
import { createCodexDriveAdapter } from '@/harnesses/codex/drive/session-drive-adapter.ts'

const sessionId = 'thread-1'

function mockDriver(overrides: Partial<Parameters<typeof createCodexDriveAdapter>[0]> = {}) {
  return {
    start: async () => sessionId,
    send: async () => {},
    interrupt: async () => {},
    compact: async () => {},
    pendingPermission: () => null,
    decidePermission: () => false,
    ...overrides,
  } as Parameters<typeof createCodexDriveAdapter>[0]
}

test('starts a Codex Session', async () => {
  const started: Array<{ attachments: unknown[]; cwd: string; prompt: string }> = []
  const adapter = createCodexDriveAdapter(
    mockDriver({
      start: async (request) => {
        started.push(request)
        return sessionId
      },
    }),
  )

  const setup = { model: 'gpt-5.6-sol', effort: 'high', mode: 'workspace-write' } as const
  const result = await adapter.start({
    attachments: [],
    cwd: '/projects/argo',
    prompt: 'Inspect the test.',
    setup,
  })
  assert.deepEqual(result, { sessionId })
  assert.deepEqual(started, [
    { attachments: [], cwd: '/projects/argo', prompt: 'Inspect the test.', setup },
  ])
})

test('reports a Codex launch failure by its named code', async () => {
  const adapter = createCodexDriveAdapter(
    mockDriver({
      start: async () => {
        throw new CodexSessionDriverError('harness-unavailable')
      },
    }),
  )

  const result = await adapter.start({ attachments: [], cwd: '/projects/argo', prompt: 'x' })
  assert.deepEqual(result, { error: 'harness-unavailable' })
})

test('sends a Turn to the selected managed Codex Session', async () => {
  const sent: Array<[string, string]> = []
  const adapter = createCodexDriveAdapter(
    mockDriver({ send: async ({ sessionId, text }) => void sent.push([sessionId, text]) }),
  )

  const result = await adapter.send({
    attachments: [],
    sessionId,
    prompt: 'Continue.',
    setup: { model: 'gpt-5.6-sol', effort: 'high', mode: 'workspace-write' },
  })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(sent, [[sessionId, 'Continue.']])
})

test('does not accept a Turn Codex could not be given', async () => {
  const adapter = createCodexDriveAdapter(
    mockDriver({
      send: async () => {
        throw new Error('Codex Session is no longer running.')
      },
    }),
  )

  const result = await adapter.send({ attachments: [], sessionId, prompt: 'x', setup: undefined })
  assert.deepEqual(result, { error: 'not-drivable' })
})

test('does not accept a Steer when the Codex driver cannot steer', async () => {
  const adapter = createCodexDriveAdapter(mockDriver())

  assert.deepEqual(await adapter.steer?.({ attachments: [], sessionId, prompt: 'Continue.' }), {
    error: 'not-drivable',
  })
})

test('refuses a malformed Turn setup before it reaches the driver', async () => {
  const setup = { model: 'gpt-5.6-luna', effort: 'ultra', mode: 'workspace-write' }
  const adapter = createCodexDriveAdapter(mockDriver())
  assert.deepEqual(
    await adapter.start({ attachments: [], cwd: '/projects/argo', prompt: 'x', setup }),
    { error: 'launch-failed' },
  )
  assert.deepEqual(await adapter.send({ attachments: [], sessionId, prompt: 'x', setup }), {
    error: 'not-drivable',
  })
})

test('reports a Codex Session another app already holds active, by the refusal it names', async () => {
  const adapter = createCodexDriveAdapter(
    mockDriver({
      send: async () => {
        throw new Error('Thread thread-1 is already active in another client.')
      },
    }),
  )

  const result = await adapter.send({ attachments: [], sessionId, prompt: 'x', setup: undefined })
  assert.deepEqual(result, { error: 'held-elsewhere' })
})

test('interrupts only the selected managed Codex Session', async () => {
  const interrupted: string[] = []
  const adapter = createCodexDriveAdapter(
    mockDriver({ interrupt: async (id) => void interrupted.push(id) }),
  )

  const result = await adapter.interrupt({ sessionId })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(interrupted, [sessionId])
})

test('compacts only the selected managed Codex Session', async () => {
  const compacted: string[] = []
  const adapter = createCodexDriveAdapter(
    mockDriver({ compact: async (id) => void compacted.push(id) }),
  )

  const result = await adapter.compact({ sessionId })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(compacted, [sessionId])
})

test('does not accept a compact Codex could not be given', async () => {
  const adapter = createCodexDriveAdapter(
    mockDriver({
      compact: async () => {
        throw new Error('Codex Session is no longer running.')
      },
    }),
  )

  const result = await adapter.compact({ sessionId })
  assert.deepEqual(result, { error: 'not-drivable' })
})
