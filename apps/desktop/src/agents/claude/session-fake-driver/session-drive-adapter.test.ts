import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ClaudePermission } from '@/core/sessions/contract'
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

  const result = await adapter.start({ cwd: '/projects/argo', prompt: 'Inspect the test.', setup })
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

  const result = await adapter.start({ cwd: '/projects/argo', prompt: 'x', setup })
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

  const result = await adapter.send({ sessionId, prompt: 'Continue with the tests.', setup })
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

    const result = await adapter.send({ sessionId, prompt: 'x', setup })
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

  const result = await adapter.send({ sessionId, prompt: 'x', setup })
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

test('reads the pending Permission the driver holds, mapped onto the shared Permission shape', async () => {
  const permission: ClaudePermission = {
    id: 'permission-1',
    sessionId,
    toolName: 'Bash',
    input: { command: 'bun test' },
  }
  const adapter = createClaudeDriveAdapter(fakeDriver({ pendingPermission: () => permission }))

  assert.deepEqual(await adapter.readPermission({ sessionId }), {
    permission: {
      id: 'permission-1',
      sessionId,
      description: 'Bash {"command":"bun test"}',
    },
  })
})

test("translates every shared decision word into the two words Claude's hook answers with", async () => {
  const decided: Array<'allow' | 'deny'> = []
  const adapter = createClaudeDriveAdapter(
    fakeDriver({
      decidePermission: (_sessionId, _permissionId, decision) => {
        decided.push(decision)
        return true
      },
    }),
  )

  for (const decision of ['allow', 'deny', 'allowForSession', 'cancel'] as const) {
    const result = await adapter.decidePermission({
      sessionId,
      permissionId: 'permission-1',
      decision,
    })
    assert.deepEqual(result, { ok: true })
  }
  assert.deepEqual(decided, ['allow', 'deny', 'allow', 'deny'])
})

test('refuses a Permission decision that is no longer waiting', async () => {
  const adapter = createClaudeDriveAdapter(fakeDriver({ decidePermission: () => false }))

  const result = await adapter.decidePermission({
    sessionId,
    permissionId: 'permission-1',
    decision: 'deny',
  })
  assert.deepEqual(result, { error: 'stale-permission' })
})
