// Confirms both Harness adapters satisfy the widened SessionDriveAdapter port (#2076): a Permission
// reaches shared code in the neutral shape, whichever Harness raised it, and every word the shared
// decision vocabulary defines type-checks through each adapter's decidePermission.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PERMISSION_DECISIONS,
  permissionSchema,
} from '@/domains/sessions/contract/drive/permission'
import type { SessionDriveAdapter } from '@/domains/sessions/contract/session-drive-adapter'
import { createClaudeDriveAdapter } from '@/harnesses/claude/drive/session-drive-adapter'
import { createCodexDriveAdapter } from '@/harnesses/codex/drive/session-drive-adapter'

function mockClaudeAdapter(): SessionDriveAdapter {
  return createClaudeDriveAdapter({
    start: () => 'session-1',
    compact: async () => {},
    beginCompaction: () => {},
    completeCompaction: () => {},
    send: async () => {},
    interrupt: () => {},
    rename: async () => 'Renamed.',
    handoff: async () => {},
    completeHandoffs: () => {},
    liveMessages: () => [],
    roster: () => [],
    onPermissionsChanged: () => () => {},
    pendingPermission: () => ({
      id: 'permission-1',
      sessionId: 'session-1',
      toolName: 'Bash',
      input: { command: 'bun test' },
    }),
    decidePermission: () => true,
    isLockedElsewhere: () => false,
    decideQuestion: async () => true,
    close: async () => {},
  })
}

function mockCodexAdapter(): SessionDriveAdapter {
  return createCodexDriveAdapter({
    start: async () => 'session-1',
    send: async () => {},
    interrupt: async () => {},
    compact: async () => {},
    rename: async () => 'Renamed.',
    roster: () => [],
    liveMessages: () => [],
    pendingQuestion: () => null,
    decideQuestion: () => true,
    close: () => {},
  })
}

test('the Claude adapter reads its pending Permission in the shared, Harness-neutral shape', async () => {
  const { permission } = await mockClaudeAdapter().readPermission({ sessionId: 'session-1' })
  assert.equal(permissionSchema.safeParse(permission).success, true)
})

test('the Codex adapter reads no pending Permission, in the same shared shape', async () => {
  const result = await mockCodexAdapter().readPermission({ sessionId: 'session-1' })
  assert.deepEqual(result, { permission: null })
})

for (const adapterName of ['claude', 'codex'] as const) {
  // Claude's mock driver always grants; Codex's stub always refuses (#1841) — every shared word
  // still type-checks through decidePermission, whichever outcome the Harness answers with.
  const expected = adapterName === 'claude' ? { ok: true } : { error: 'stale-permission' }
  for (const decision of PERMISSION_DECISIONS) {
    test(`the ${adapterName} adapter's decidePermission accepts the shared word "${decision}"`, async () => {
      const adapter = adapterName === 'claude' ? mockClaudeAdapter() : mockCodexAdapter()
      const result = await adapter.decidePermission({
        sessionId: 'session-1',
        permissionId: 'permission-1',
        decision,
      })
      assert.deepEqual(result, expected)
    })
  }
}
