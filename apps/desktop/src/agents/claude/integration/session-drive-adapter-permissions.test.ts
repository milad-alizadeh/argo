// The Claude drive adapter's Permission surface, split from session-drive-adapter.test.ts to stay
// under the file's line cap: reading a pending Permission and deciding one.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ClaudePermissionDecision } from '@/agents/claude/drive/permission-gate'
import { createClaudeDriveAdapter } from '@/agents/claude/drive/session-drive-adapter.ts'
import type { ClaudePermission } from '@/domains/sessions/contract/contract'
import { mockDriver, sessionId } from '../../../../mocks/cli/claude/mock-claude-driver.ts'

test('reads the pending Permission the driver holds, mapped onto the shared Permission shape', async () => {
  const permission: ClaudePermission = {
    id: 'permission-1',
    sessionId,
    toolName: 'Bash',
    input: { command: 'bun test' },
  }
  const adapter = createClaudeDriveAdapter(mockDriver({ pendingPermission: () => permission }))

  assert.deepEqual(await adapter.readPermission({ sessionId }), {
    permission: {
      id: 'permission-1',
      sessionId,
      description: 'Bash {"command":"bun test"}',
    },
  })
})

test("translates every shared decision word into the words Claude's gate answers with", async () => {
  const decided: ClaudePermissionDecision[] = []
  const adapter = createClaudeDriveAdapter(
    mockDriver({
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
  assert.deepEqual(decided, ['allow', 'deny', 'allowSimilar', 'deny'])
})

test('refuses a Permission decision that is no longer waiting', async () => {
  const adapter = createClaudeDriveAdapter(mockDriver({ decidePermission: () => false }))

  const result = await adapter.decidePermission({
    sessionId,
    permissionId: 'permission-1',
    decision: 'deny',
  })
  assert.deepEqual(result, { error: 'stale-permission' })
})
