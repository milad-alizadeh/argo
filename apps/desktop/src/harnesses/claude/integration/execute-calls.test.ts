import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { fed, feedRequest, rowsOf } from '@/domains/sessions/main/observation/reader-test-helpers'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions'
import { fixtureRoot, fixtureRosterRow } from './session-fixtures'

// A background command runs until something ends it; the Harness's `killed` and a stop call both read
// as `interrupted`, and the stop call draws no row of its own (#2443).
test('ends a stopped background command as interrupted and draws no row for the stop call', async (context) => {
  const shell = (await fixtureRosterRow(['shellStopped'])).shell
  assert.deepEqual(
    shell.map(({ id, background, state, endedAt }) => ({ id, background, state, endedAt })),
    [
      {
        id: 'st-call-watch',
        background: true,
        state: 'interrupted',
        endedAt: '2026-09-19T09:00:10.000Z',
      },
      {
        id: 'st-call-build',
        background: true,
        state: 'interrupted',
        endedAt: '2026-09-19T09:00:20.000Z',
      },
    ],
  )

  const root = await fixtureRoot(context, ['shellStopped'])
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])
  const rows = rowsOf(await fed(reader, feedRequest('shellStopped')))
  const calls = rows.flatMap((row) =>
    row.shape === 'tool-group' ? row.calls.map(({ status, text }) => ({ status, text })) : [],
  )
  assert.deepEqual(calls, [
    { status: 'interrupted', text: 'npm run watch' },
    { status: 'interrupted', text: 'bun run build' },
  ])
})

test('labels a command by its description, else by the first line of what ran', async (context) => {
  const root = await fixtureRoot(context, ['shellRunning'])
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])
  const rows = rowsOf(await fed(reader, feedRequest('shellRunning')))
  const labels = rows.flatMap((row) =>
    row.shape === 'tool-group' ? row.calls.map(({ label }) => label) : [],
  )
  assert.ok(labels.includes('run the suite'))
  assert.ok(labels.includes('Ran bun run build'))
})
