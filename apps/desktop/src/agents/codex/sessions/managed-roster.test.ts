import assert from 'node:assert/strict'
import { test } from 'node:test'
import { managedRow } from '@/core/sessions/managed-row'
import { createSessionReader } from '@/core/sessions/reader'
import { listed, tempRoot } from '@/core/sessions/reader-test-helpers'
import { codexSessionSource } from './read-sessions'

// The AC that a managed Session with no transcript yet appears in the Roster holds for each CLI
// (claude-driver-launch.ts and managed-permission-roster.test.ts cover Claude's side).
test('a managed Codex Session with no transcript yet appears in the Roster with the `managed` posture', async (context) => {
  const root = await tempRoot(context)
  const row = managedRow('thread-1', {
    cli: 'codex',
    cwd: '/projects/argo',
    status: 'running',
    setup: { model: null, effort: null, mode: null },
    prompt: 'Inspect the failing test.',
    startedAt: '2026-09-13T15:17:11.000Z',
  })
  const reader = createSessionReader([codexSessionSource(root, { roster: () => [row] })])

  const reply = await listed(reader)
  assert.deepEqual(
    reply?.sessions.map(({ id, posture }) => ({ id, posture })),
    [{ id: 'thread-1', posture: 'managed' }],
  )
})
