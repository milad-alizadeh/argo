import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CodexSessionDriverError } from '../drive/codex-session-error.ts'
import { createCodexDriveAdapter } from '../drive/session-drive-adapter.ts'

const sessionId = 'thread-1'

function fakeDriver(overrides: Partial<Parameters<typeof createCodexDriveAdapter>[0]> = {}) {
  return {
    start: async () => sessionId,
    send: async () => {},
    interrupt: async () => {},
    ...overrides,
  } as Parameters<typeof createCodexDriveAdapter>[0]
}

test('refuses any Turn setup a composer sends, since Codex declares none yet (#1885)', () => {
  const adapter = createCodexDriveAdapter(fakeDriver())
  assert.equal(adapter.turnSetupSchema.safeParse(undefined).success, true)
  assert.equal(adapter.turnSetupSchema.safeParse({ model: 'gpt' }).success, false)
})

test('starts a Codex Session', async () => {
  const started: Array<{ cwd: string; prompt: string }> = []
  const adapter = createCodexDriveAdapter(
    fakeDriver({
      start: async (request) => {
        started.push(request)
        return sessionId
      },
    }),
  )

  const result = await adapter.start({ cwd: '/projects/argo', prompt: 'Inspect the test.' })
  assert.deepEqual(result, { sessionId })
  assert.deepEqual(started, [{ cwd: '/projects/argo', prompt: 'Inspect the test.' }])
})

test('reports a Codex launch failure by its named code', async () => {
  const adapter = createCodexDriveAdapter(
    fakeDriver({
      start: async () => {
        throw new CodexSessionDriverError('cli-unavailable')
      },
    }),
  )

  const result = await adapter.start({ cwd: '/projects/argo', prompt: 'x' })
  assert.deepEqual(result, { error: 'cli-unavailable' })
})

test('sends a Turn to the selected managed Codex Session', async () => {
  const sent: Array<[string, string]> = []
  const adapter = createCodexDriveAdapter(
    fakeDriver({ send: async (id, text) => void sent.push([id, text]) }),
  )

  const result = await adapter.send({ sessionId, prompt: 'Continue.', setup: undefined })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(sent, [[sessionId, 'Continue.']])
})

test('does not accept a Turn Codex could not be given', async () => {
  const adapter = createCodexDriveAdapter(
    fakeDriver({
      send: async () => {
        throw new Error('Codex Session is no longer running.')
      },
    }),
  )

  const result = await adapter.send({ sessionId, prompt: 'x', setup: undefined })
  assert.deepEqual(result, { error: 'not-drivable' })
})

test('interrupts only the selected managed Codex Session', async () => {
  const interrupted: string[] = []
  const adapter = createCodexDriveAdapter(
    fakeDriver({ interrupt: async (id) => void interrupted.push(id) }),
  )

  const result = await adapter.interrupt({ sessionId })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(interrupted, [sessionId])
})

test('refuses compaction, which Codex does not support yet', async () => {
  const adapter = createCodexDriveAdapter(fakeDriver())
  assert.deepEqual(await adapter.compact({ sessionId }), { error: 'not-drivable' })
})

test('reads no pending Permission, since Codex Permissions are #1841', async () => {
  const adapter = createCodexDriveAdapter(fakeDriver())
  assert.deepEqual(await adapter.readPermission({ sessionId }), { permission: null })
})

test('refuses a Codex Permission decision, since none is ever waiting', async () => {
  const adapter = createCodexDriveAdapter(fakeDriver())
  const result = await adapter.decidePermission({
    sessionId,
    permissionId: 'permission-1',
    decision: 'allow',
  })
  assert.deepEqual(result, { error: 'stale-permission' })
})
