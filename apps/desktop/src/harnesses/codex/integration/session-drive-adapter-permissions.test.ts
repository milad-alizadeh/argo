import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createCodexDriveAdapter } from '@/harnesses/codex/drive/session-drive-adapter.ts'

const sessionId = 'thread-1'

function driver(overrides: Partial<Parameters<typeof createCodexDriveAdapter>[0]> = {}) {
  return {
    pendingPermission: () => null,
    decidePermission: () => false,
    ...overrides,
  } as Parameters<typeof createCodexDriveAdapter>[0]
}

test('reads a pending Codex Permission', async () => {
  const adapter = createCodexDriveAdapter(
    driver({
      pendingPermission: () => ({
        id: 'permission-1',
        requestId: 1,
        sessionId,
        description: 'Run gh issue create',
      }),
    }),
  )
  assert.deepEqual(await adapter.readPermission({ sessionId }), {
    permission: { id: 'permission-1', sessionId, description: 'Run gh issue create' },
  })
})

test('passes a Codex Permission decision to its driver', async () => {
  const decisions: string[] = []
  const adapter = createCodexDriveAdapter(
    driver({
      decidePermission: (_sessionId, _permissionId, decision) => {
        decisions.push(decision)
        return true
      },
    }),
  )
  assert.deepEqual(
    await adapter.decidePermission({ sessionId, permissionId: 'permission-1', decision: 'allow' }),
    { ok: true },
  )
  assert.deepEqual(decisions, ['allow'])
})
