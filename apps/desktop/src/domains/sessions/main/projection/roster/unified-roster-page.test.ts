import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rosterRow } from '@/domains/sessions/contract/observation/roster-row-test-fixture'
import { mergeRosterPage } from './unified-roster-page'

test('keeps the rows that do not fit in the merged first page in its opaque state', () => {
  const result = mergeRosterPage(
    [
      {
        harness: 'claude',
        nextCursor: 'claude-2',
        rows: [
          rosterRow({ id: 'claude-new', harness: 'claude', updatedAt: '2026-09-23T10:00:00.000Z' }),
          rosterRow({ id: 'claude-old', harness: 'claude', updatedAt: '2026-09-23T08:00:00.000Z' }),
        ],
      },
      {
        harness: 'codex',
        nextCursor: null,
        rows: [
          rosterRow({ id: 'codex-new', harness: 'codex', updatedAt: '2026-09-23T09:00:00.000Z' }),
        ],
      },
    ],
    2,
  )

  assert.deepEqual(
    result.sessions.map((session) => session.id),
    ['claude-new', 'codex-new'],
  )
  const claude = result.cursor.sources.claude
  assert.ok(claude !== undefined)
  assert.deepEqual(
    claude.buffer.map((session) => session.id),
    ['claude-old'],
  )
  assert.equal(claude.cursor, 'claude-2')
})
