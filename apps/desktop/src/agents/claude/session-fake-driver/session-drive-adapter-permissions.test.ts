// The Claude drive adapter's Permission surface, split from session-drive-adapter.test.ts to stay
// under the file's line cap: reading a pending Permission and deciding one.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ClaudePermission } from '@/core/sessions/contract'
import { createClaudeDriveAdapter } from '../drive/session-drive-adapter.ts'

const sessionId = 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'

function fakeDriver(overrides: Partial<Parameters<typeof createClaudeDriveAdapter>[0]> = {}) {
  return {
    start: () => sessionId,
    compact: async () => {},
    send: async () => {},
    interrupt: () => {},
    pendingPermission: () => null,
    decidePermission: () => true,
    ...overrides,
  } as Parameters<typeof createClaudeDriveAdapter>[0]
}

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
