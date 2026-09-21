import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  codexApprovalDecision,
  readRequestApproval,
} from '@/harnesses/codex/drive/permission-protocol'

test('reads an additional-permissions approval request', () => {
  const permission = readRequestApproval({
    id: 42,
    method: 'item/permissions/requestApproval',
    params: {
      cwd: '/workspace',
      itemId: 'item-1',
      permissions: { network: { enabled: true } },
      reason: 'Allow browser access',
      startedAtMs: 1,
      threadId: 'thread-1',
      turnId: 'turn-1',
    },
  })
  assert.deepEqual(permission, {
    id: 'item-1',
    requestId: 42,
    sessionId: 'thread-1',
    description: 'Allow browser access',
    additionalPermissions: { network: { enabled: true } },
  })
  assert.deepEqual(
    codexApprovalDecision(permission ?? assert.fail('Missing permission'), 'allow'),
    { permissions: { network: { enabled: true } }, scope: 'turn' },
  )
})
