import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCodexDriveAdapter } from '@/harnesses/codex/drive/session-drive-adapter.ts'

const sessionId = 'thread-1'

function mockDriver(overrides: Partial<Parameters<typeof createCodexDriveAdapter>[0]> = {}) {
  return {
    start: async () => sessionId,
    send: async () => {},
    interrupt: async () => {},
    compact: async () => {},
    ...overrides,
  } as Parameters<typeof createCodexDriveAdapter>[0]
}

test('accepts the Codex Turn setup the adapter declares', () => {
  const adapter = createCodexDriveAdapter(mockDriver())
  assert.equal(
    adapter.turnSetupSchema.safeParse({
      model: 'gpt-5.6-sol',
      effort: 'high',
      mode: 'workspace-write',
    }).success,
    true,
  )
  assert.equal(adapter.turnSetupSchema.safeParse(undefined).success, true)
  assert.equal(
    adapter.turnSetupSchema.safeParse({
      model: 'gpt-5.6-luna',
      effort: 'ultra',
      mode: 'workspace-write',
    }).success,
    false,
  )
})

test('refuses a malformed Turn setup before it reaches the driver', async () => {
  const setup = { model: 'gpt-5.6-luna', effort: 'ultra', mode: 'workspace-write' }
  const adapter = createCodexDriveAdapter(mockDriver())
  const start = adapter.start({ attachments: [], cwd: '/projects/argo', prompt: 'x', setup })
  assert.deepEqual(await start, { error: 'launch-failed' })
  const send = adapter.send({ attachments: [], sessionId, prompt: 'x', setup })
  assert.deepEqual(await send, { error: 'not-drivable' })
})
