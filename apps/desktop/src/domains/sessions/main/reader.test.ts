// The shared Session reader, built from the real Claude and Codex adapters over temporary fixture
// folders (#2025). Every test goes through the reader's own interface, the one the Session
// bridge calls, so a refactor inside it leaves these green.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import { createSessionReader } from '@/domains/sessions/main/reader'
import {
  fed,
  feedRequest,
  listed,
  tempRoot,
  writeClaudeTranscript,
  writeCodexTranscript,
} from '@/domains/sessions/main/reader-test-helpers'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'
import { managedRow } from '@/harnesses/session/managed-row'

test('reads a Feed from the adapter the Roster names as owner, not the first one registered', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  // The same Session id in both folders, with different content, is the fixture ADR-0024's
  // driving spec calls for. Today the object-identity owner check in the deleted combining
  // module never remembers an owner, so the Claude reply always won.
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'managed-dup',
    text: 'From Claude.',
    updatedAt: '2026-09-13T10:00:00.000Z',
  })
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'managed-dup',
    text: 'From Codex.',
    updatedAt: '2026-09-13T10:00:00.000Z',
  })

  const managed: SessionRosterRow[] = [
    managedRow('managed-dup', {
      harness: 'codex',
      cwd: '/proj',
      status: 'running',
      setup: { model: null, effort: null, mode: null },
      prompt: 'Managed by codex.',
      startedAt: '2026-09-13T09:00:00.000Z',
    }),
  ]
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot, { roster: () => managed }),
  ])

  const reply = await fed(reader, feedRequest('managed-dup'))
  assert.equal(reply.type, 'session.feed.read')
  assert.ok(
    reply.type === 'session.feed.read' &&
      reply.rows.some((row) => 'text' in row && row.text === 'From Codex.'),
  )
})

test('reads a Feed from the CLI the most recent listing named as owner, with no managed row at all', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  // Same fixture shape as the managed-row test above, but routed purely off discovery: no
  // driver reports either session id as managed, so `ownerFor` must fall back to
  // `lastDiscoveredHarness` rather than the managed-report branch.
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'dup',
    text: 'From Claude.',
    updatedAt: '2026-09-13T10:00:00.000Z',
  })
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'dup',
    text: 'From Codex.',
    updatedAt: '2026-09-13T10:00:05.000Z',
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  await listed(reader)
  const reply = await fed(reader, feedRequest('dup'))
  assert.equal(
    reply.type === 'session.feed.read' &&
      reply.rows.some((row) => 'text' in row && row.text === 'From Codex.'),
    true,
  )
})

test('lists Sessions from both HARNESSES, newest first', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'claudeOne',
    text: 'Hi.',
    updatedAt: '2026-09-13T09:00:00.000Z',
  })
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'codexOne',
    text: 'Hi.',
    updatedAt: '2026-09-13T11:00:00.000Z',
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  const reply = await listed(reader)
  assert.deepEqual(
    reply?.sessions.map((session) => session.id),
    ['codexOne', 'claudeOne'],
  )
  assert.deepEqual({ found: reply?.filesFound, read: reply?.filesRead }, { found: 2, read: 2 })
})

test('lists the Sessions it can reach when one CLI folder is missing', async (context) => {
  const claudeRoot = await tempRoot(context)
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'claudeOne',
    text: 'Hi.',
    updatedAt: '2026-09-13T09:00:00.000Z',
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(`${claudeRoot}/absent`),
  ])

  const reply = await listed(reader)
  assert.deepEqual(
    reply?.sessions.map((session) => session.id),
    ['claudeOne'],
  )
  assert.deepEqual({ found: reply?.filesFound, read: reply?.filesRead }, { found: 1, read: 1 })
})
