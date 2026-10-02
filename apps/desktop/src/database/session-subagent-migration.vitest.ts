import { expect, test } from 'vitest'
import { migratedFromBefore } from '@/mocks/database/database-before-migration'

const IDENTITY_MIGRATION = '20261002052125_session_subagent_identity'
// A database migrated from just before Subagents were keyed by Harness and native ID.
function migratedFromBeforeIdentity() {
  return migratedFromBefore(
    IDENTITY_MIGRATION,
    `
    INSERT INTO session (argo_id, harness, native_id) VALUES
      ('session-claude', 'claude', 'native-claude'),
      ('session-codex', 'codex', 'native-codex'),
      ('session-codex-later', 'codex', 'native-codex-later');
    INSERT INTO session_subagent (session_id, subagent_id, label, state) VALUES
      ('session-claude', 'agent-1', 'Survey', 'completed'),
      ('session-codex', 'thread-child', NULL, 'unknown'),
      ('session-codex-later', 'thread-child', 'Later', 'running'),
      ('session-codex', 'agent-1', NULL, 'running');
  `,
  )
}

test('keys each saved Subagent by its parent’s Harness and its native ID, keeping parent, label and state', async () => {
  const client = await migratedFromBeforeIdentity()
  expect(
    client
      .prepare(
        'SELECT harness, native_id, parent_session_id, label, state FROM session_subagent ORDER BY rowid',
      )
      .all(),
  ).toEqual([
    {
      harness: 'claude',
      native_id: 'agent-1',
      parent_session_id: 'session-claude',
      label: 'Survey',
      state: 'completed',
    },
    // One Subagent ID under two parents keeps the row saved first.
    {
      harness: 'codex',
      native_id: 'thread-child',
      parent_session_id: 'session-codex',
      label: null,
      state: 'unknown',
    },
    {
      harness: 'codex',
      native_id: 'agent-1',
      parent_session_id: 'session-codex',
      label: null,
      state: 'running',
    },
  ])
})
