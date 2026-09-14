import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ClaudeTurnRequest } from '../drive/deliver-turn.ts'
import { ClaudeSessionDriverError } from '../drive/driver-error.ts'
import { createClaudeDriveAdapter } from '../drive/session-drive-adapter.ts'

const sessionId = 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'
const setup = { model: 'haiku', effort: 'low', mode: 'plan' } as const

function fakeDriver(overrides: Partial<Parameters<typeof createClaudeDriveAdapter>[0]> = {}) {
  return {
    start: () => sessionId,
    compact: async () => {},
    send: async () => {},
    interrupt: () => {},
    pendingPermission: () => null,
    decidePermission: () => true,
    isLockedElsewhere: () => false,
    ...overrides,
  } as Parameters<typeof createClaudeDriveAdapter>[0]
}

test('starts a Claude Session at its chosen Turn setup', async () => {
  const started: Array<{ cwd: string } & ClaudeTurnRequest> = []
  const adapter = createClaudeDriveAdapter(
    fakeDriver({
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
    fakeDriver({
      start: () => {
        throw new ClaudeSessionDriverError('cli-unavailable')
      },
    }),
  )

  const result = await adapter.start({ cwd: '/projects/argo', prompt: 'x', setup, attachments: [] })
  assert.deepEqual(result, { error: 'cli-unavailable' })
})

test('sends a subsequent Turn to the selected managed Claude Session', async () => {
  const sent: Array<[string, ClaudeTurnRequest]> = []
  const adapter = createClaudeDriveAdapter(
    fakeDriver({
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
      fakeDriver({
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
    fakeDriver({
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
    fakeDriver({ interrupt: (receivedSessionId) => interrupted.push(receivedSessionId) }),
  )

  const result = await adapter.interrupt({ sessionId })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(interrupted, [sessionId])
})

test('compacts only the selected managed Claude Session', async () => {
  const compacted: string[] = []
  const adapter = createClaudeDriveAdapter(
    fakeDriver({ compact: async (receivedSessionId) => void compacted.push(receivedSessionId) }),
  )

  const result = await adapter.compact({ sessionId })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(compacted, [sessionId])
})
