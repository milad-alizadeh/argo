import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readerOverRollout } from '@/agents/codex/sessions/rollout-reader-test-helper'
import {
  fed,
  feedRequest,
  listed,
  rowsOf,
} from '@/domains/sessions/main/observation/reader-test-helpers'

const SESSION = 'codexLegacyShell'

test('reads both legacy shell shapes as commands and lists the running one in the Roster', async (context) => {
  const reader = await readerOverRollout(context, {
    fixture: 'rollout-codexLegacyShell.jsonl',
    session: SESSION,
  })
  const rows = rowsOf(await fed(reader, feedRequest(SESSION)))
  const calls = rows.flatMap((row) =>
    row.shape === 'tool-group'
      ? row.calls.map(({ kind, status, label, text }) => ({ kind, status, label, text }))
      : [],
  )
  assert.deepEqual(calls, [
    { kind: 'command', status: 'succeeded', label: 'Ran ls -la', text: 'ls -la' },
    {
      kind: 'command',
      status: 'running',
      label: 'Ran git status --short',
      text: 'git status --short',
    },
  ])
  const roster = (await listed(reader))?.sessions.find((row) => row.id === SESSION)
  assert.deepEqual(
    roster?.shell.map(({ command, state }) => ({ command, state })),
    [{ command: 'git status --short', state: 'running' }],
  )
})
