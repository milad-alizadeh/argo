// Confirms both CLI adapters satisfy the widened SessionDriveAdapter port (#2076): a Permission
// reaches shared code in the neutral shape, whichever CLI raised it, and every word the shared
// decision vocabulary defines type-checks through each adapter's decidePermission.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClaudeDriveAdapter } from '../../agents/claude/drive/session-drive-adapter'
import { createCodexDriveAdapter } from '../../agents/codex/drive/session-drive-adapter'
import { PERMISSION_DECISIONS, PERMISSION_DECISIONS_BY_CLI, permissionSchema } from './permission'
import type { SessionDriveAdapter } from './session-drive-adapter'

function fakeClaudeAdapter(): SessionDriveAdapter {
  return createClaudeDriveAdapter({
    start: () => 'session-1',
    compact: async () => {},
    completeCompaction: () => {},
    send: async () => {},
    interrupt: () => {},
    rename: async () => 'Renamed.',
    handoff: async () => {},
    completeHandoffs: () => {},
    liveMessages: () => [],
    roster: () => [],
    orphans: () => new Set(),
    pendingPermission: () => ({
      id: 'permission-1',
      sessionId: 'session-1',
      toolName: 'Bash',
      input: { command: 'bun test' },
    }),
    decidePermission: () => true,
    decideQuestion: async () => true,
    close: () => {},
  })
}

function fakeCodexAdapter(): SessionDriveAdapter {
  return createCodexDriveAdapter({
    start: async () => 'session-1',
    send: async () => {},
    interrupt: async () => {},
    rename: async () => 'Renamed.',
    roster: () => [],
    liveMessages: () => [],
    close: () => {},
  })
}

test('the Claude adapter reads its pending Permission in the shared, CLI-neutral shape', async () => {
  const { permission } = await fakeClaudeAdapter().readPermission({ sessionId: 'session-1' })
  assert.equal(permissionSchema.safeParse(permission).success, true)
})

test('the Codex adapter reads no pending Permission, in the same shared shape', async () => {
  const result = await fakeCodexAdapter().readPermission({ sessionId: 'session-1' })
  assert.deepEqual(result, { permission: null })
})

test('names which decision words each CLI actually answers with', () => {
  assert.deepEqual(PERMISSION_DECISIONS_BY_CLI.claude, ['allow', 'deny'])
  assert.deepEqual(PERMISSION_DECISIONS_BY_CLI.codex, [
    'allow',
    'deny',
    'allowForSession',
    'cancel',
  ])
})

for (const adapterName of ['claude', 'codex'] as const) {
  // Claude's fake driver always grants; Codex's stub always refuses (#1841) — every shared word
  // still type-checks through decidePermission, whichever outcome the CLI answers with.
  const expected = adapterName === 'claude' ? { ok: true } : { error: 'stale-permission' }
  for (const decision of PERMISSION_DECISIONS) {
    test(`the ${adapterName} adapter's decidePermission accepts the shared word "${decision}"`, async () => {
      const adapter = adapterName === 'claude' ? fakeClaudeAdapter() : fakeCodexAdapter()
      const result = await adapter.decidePermission({
        sessionId: 'session-1',
        permissionId: 'permission-1',
        decision,
      })
      assert.deepEqual(result, expected)
    })
  }
}
