import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ClaudePermission } from '@/domains/sessions/contract/ipc/contract.ts'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { createSessionReader } from '@/domains/sessions/main/observation/reader/reader'
import { listed } from '@/domains/sessions/main/observation/reader/reader-test-helpers'
import type { ClaudePermissionGate } from '../drive/permission/permission-gate'
import { claudeSessionSource } from '../sessions/discovery/read-sessions'
import { launch, ledgerFile, OPENING } from './claude-driver-launch'
import { fixtureRoot } from './session-fixtures'

// A gate whose pending Permission this suite sets directly, so a test can raise one without
// driving the real socket and hook a Claude process would use.
function heldPermissionGate(): ClaudePermissionGate & {
  raise: (permission: ClaudePermission) => void
} {
  const pendingBySession = new Map<string, ClaudePermission>()
  return {
    open: () => ({
      hook: { event: 'PreToolUse', file: 'permission-hook.sh', script: '' },
      close: () => {},
    }),
    pending: (sessionId) => pendingBySession.get(sessionId) ?? null,
    decide: (sessionId, permissionId, decision) => {
      const held = pendingBySession.get(sessionId)
      if (held === undefined || held.id !== permissionId) return false
      pendingBySession.delete(sessionId)
      return decision === 'allow' || decision === 'deny'
    },
    close: () => {},
    raise: (permission) => pendingBySession.set(permission.sessionId, permission),
  }
}

function managedReader(root: string, roster: () => SessionRosterRow[]) {
  return createSessionReader([claudeSessionSource({ transcripts: root, managedSessions: roster })])
}

function rowOf(reply: Awaited<ReturnType<typeof listed>>, sessionId: string) {
  return reply?.sessions.find((session) => session.id === sessionId)
}

test('a managed Session with a transcript and a pending Permission reads `permission` in the Roster, and the transcript status once it is answered', async (context) => {
  // `11111111-2222-4333-8444-555555555555` closes its Turn with `end_turn`, so its own reading is `idle` (session-status.test.ts).
  const root = await fixtureRoot(context, ['11111111-2222-4333-8444-555555555555'])
  const gate = heldPermissionGate()
  const { driver } = launch(await ledgerFile(context), {
    gate,
    mintSessionId: () => '11111111-2222-4333-8444-555555555555',
  })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  const reader = managedReader(root, driver.roster)

  gate.raise({ id: 'permission-1', sessionId, toolName: 'Bash', input: { command: 'bun test' } })
  const pending = await listed(reader)
  assert.deepEqual(
    { posture: rowOf(pending, sessionId)?.posture, status: rowOf(pending, sessionId)?.status },
    { posture: 'managed', status: 'permission' },
  )

  assert.equal(driver.decidePermission(sessionId, 'permission-1', 'allow'), true)
  const answered = await listed(reader)
  assert.deepEqual(
    { posture: rowOf(answered, sessionId)?.posture, status: rowOf(answered, sessionId)?.status },
    { posture: 'managed', status: 'idle' },
  )
})

test('a managed Session that discovery found keeps the `managed` posture, and a running but idle one does not read `running` only because the driver holds it', async (context) => {
  const root = await fixtureRoot(context, ['11111111-2222-4333-8444-555555555555'])
  const { driver } = launch(await ledgerFile(context), {
    mintSessionId: () => '11111111-2222-4333-8444-555555555555',
  })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  const reader = managedReader(root, driver.roster)

  const reply = await listed(reader)
  assert.deepEqual(
    { posture: rowOf(reply, sessionId)?.posture, status: rowOf(reply, sessionId)?.status },
    { posture: 'managed', status: 'idle' },
  )
})

test('a managed Session with no transcript yet appears in the Roster with the `managed` posture', async (context) => {
  const root = await fixtureRoot(context, [])
  const { driver } = launch(await ledgerFile(context))
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  const reader = managedReader(root, driver.roster)

  const reply = await listed(reader)
  assert.deepEqual(
    reply.sessions.map(({ id, posture }) => ({ id, posture })),
    [{ id: sessionId, posture: 'managed' }],
  )
})

test('a Claude Session Argo does not currently drive still reads `external`', async (context) => {
  const root = await fixtureRoot(context, ['11111111-2222-4333-8444-555555555555'])
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])

  const reply = await listed(reader)
  assert.equal(rowOf(reply, '11111111-2222-4333-8444-555555555555')?.posture, 'external')
})
