import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ClaudeTurnRequest } from '@/harnesses/claude/drive/deliver-turn.ts'
import { ClaudeSessionDriverError } from '@/harnesses/claude/drive/driver-error.ts'
import { createClaudeDriveAdapter } from '@/harnesses/claude/drive/session-drive-adapter.ts'
import { mockDriver, sessionId } from '../../../../mocks/cli/claude/mock-claude-driver.ts'

const setup = { model: 'haiku', effort: 'low', mode: 'plan' } as const

test('starts a Claude Session at its chosen Turn setup', async () => {
  const started: Array<{ cwd: string } & ClaudeTurnRequest> = []
  const adapter = createClaudeDriveAdapter(
    mockDriver({
      start: (request) => {
        started.push(request)
        return sessionId
      },
    }),
  )

  const result = await adapter.start({
    cwd: '/projects/argo',
    prompt: 'Inspect the test.',
    setup,
    attachments: [],
  })
  assert.deepEqual(result, { sessionId })
  assert.deepEqual(started, [{ cwd: '/projects/argo', prompt: 'Inspect the test.', setup }])
})

test('reports a Claude launch failure by its named code', async () => {
  const adapter = createClaudeDriveAdapter(
    mockDriver({
      start: () => {
        throw new ClaudeSessionDriverError('harness-unavailable')
      },
    }),
  )

  const result = await adapter.start({ cwd: '/projects/argo', prompt: 'x', setup, attachments: [] })
  assert.deepEqual(result, { error: 'harness-unavailable' })
})

test('sends a subsequent Turn to the selected managed Claude Session', async () => {
  const sent: Array<[string, ClaudeTurnRequest]> = []
  const adapter = createClaudeDriveAdapter(
    mockDriver({
      send: async (receivedSessionId, turn) => {
        sent.push([receivedSessionId, turn])
      },
    }),
  )

  const result = await adapter.send({
    sessionId,
    prompt: 'Continue with the tests.',
    setup,
    attachments: [],
  })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(sent, [[sessionId, { prompt: 'Continue with the tests.', setup }]])
})

for (const code of [
  'not-drivable',
  'held-elsewhere',
  'missing-session',
  'launch-failed',
] as const) {
  test(`answers a Turn the driver refuses as ${code} with that reason`, async () => {
    const adapter = createClaudeDriveAdapter(
      mockDriver({
        send: async () => {
          throw new ClaudeSessionDriverError(code)
        },
      }),
    )

    const result = await adapter.send({ sessionId, prompt: 'x', setup, attachments: [] })
    assert.deepEqual(result, { error: code })
  })
}

test('does not accept a Turn Claude could not be given', async () => {
  const adapter = createClaudeDriveAdapter(
    mockDriver({
      send: async () => {
        throw new Error('Claude Session is no longer running.')
      },
    }),
  )

  const result = await adapter.send({ sessionId, prompt: 'x', setup, attachments: [] })
  assert.deepEqual(result, { error: 'not-drivable' })
})

test('interrupts only the selected managed Claude Session', async () => {
  const interrupted: string[] = []
  const adapter = createClaudeDriveAdapter(
    mockDriver({ interrupt: (receivedSessionId) => interrupted.push(receivedSessionId) }),
  )

  const result = await adapter.interrupt({ sessionId })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(interrupted, [sessionId])
})

test('refuses to start a Claude Session with a malformed Turn setup', async () => {
  const adapter = createClaudeDriveAdapter(
    mockDriver({
      start: () => {
        throw new Error('A malformed setup must not reach the driver.')
      },
    }),
  )

  const result = await adapter.start({
    cwd: '/projects/argo',
    prompt: 'x',
    setup: { model: 'not-a-model', effort: 'low', mode: 'plan' },
    attachments: [],
  })
  assert.deepEqual(result, { error: 'launch-failed' })
})

test('refuses to send a Turn with a malformed Turn setup', async () => {
  const adapter = createClaudeDriveAdapter(
    mockDriver({
      send: async () => {
        throw new Error('A malformed setup must not reach the driver.')
      },
    }),
  )

  const result = await adapter.send({
    sessionId,
    prompt: 'x',
    setup: { model: 'haiku', effort: 'low' },
    attachments: [],
  })
  assert.deepEqual(result, { error: 'not-drivable' })
})

test('compacts only the selected managed Claude Session', async () => {
  const compacted: string[] = []
  const adapter = createClaudeDriveAdapter(
    mockDriver({ compact: async (receivedSessionId) => void compacted.push(receivedSessionId) }),
  )

  const result = await adapter.compact({ sessionId })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(compacted, [sessionId])
})
