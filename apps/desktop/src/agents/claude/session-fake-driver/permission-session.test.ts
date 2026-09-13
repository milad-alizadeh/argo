import { expect, test } from 'bun:test'

import { decideClaudePermission, readClaudePermission } from '../drive/permission-session'

const permission = { id: 'permission-one', sessionId: 'session-one', toolName: 'Bash', input: {} }
const driver = {
  pendingPermission: () => permission,
  decidePermission: (_sessionId: string, permissionId: string) => permissionId === permission.id,
} as never

test('reads the selected managed Session permission', () => {
  expect(
    readClaudePermission(
      {
        version: 1,
        type: 'session.claude.permission',
        requestId: 'read-one',
        sessionId: 'session-one',
      },
      driver,
    ),
  ).toMatchObject({ type: 'session.claude.permission.read', permission })
})

test('rejects a stale permission answer', () => {
  expect(
    decideClaudePermission(
      {
        version: 1,
        type: 'session.claude.permission.decide',
        requestId: 'decide-one',
        sessionId: 'session-one',
        permissionId: 'stale',
        decision: 'deny',
      },
      driver,
    ),
  ).toMatchObject({ type: 'session.error', code: 'stale-permission' })
})
