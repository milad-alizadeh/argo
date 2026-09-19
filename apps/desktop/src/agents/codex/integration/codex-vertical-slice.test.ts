// The #1839 vertical slice, driven end to end over a real child process and real stdio pipes: a
// fixture app-server (fixtures/mock-codex-app-server.ts) stands in for `codex app-server`, so this
// proves the wire framing and the driver together, not just an in-memory mock of `CodexChannel`.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createCodexDriveAdapter } from '@/agents/codex/drive/session-drive-adapter.ts'
import { codexSessionSource } from '@/agents/codex/sessions/read-sessions.ts'
import { compactSession, sendSession, startSession } from '@/domains/sessions/main/drive.ts'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { driverBackedByFixture } from '../../../../mocks/cli/codex/mock-codex-driver.ts'

test('starting a Codex Session over the real transport makes it appear in the shared Roster', async () => {
  const driver = driverBackedByFixture()
  const adapters = { codex: createCodexDriveAdapter(driver) }
  try {
    const startReply = await startSession(
      {
        version: 1,
        type: 'session.start',
        requestId: 'start-1',
        cli: 'codex',
        cwd: process.cwd(),
        prompt: 'Inspect the failing test.',
      },
      adapters,
    )
    assert.equal(startReply.type, 'session.started')
    const sessionId = startReply.type === 'session.started' ? startReply.sessionId : ''

    const transcripts = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-vertical-slice-'))
    const reader = createSessionReader([codexSessionSource(transcripts, { roster: driver.roster })])
    const listing = (await reader.listSessions({
      version: 1,
      type: 'session.list',
      requestId: 'list-1',
      projectRoot: null,
    })) as { type: string; sessions?: Array<{ id: string; status: string }> }
    assert.equal(listing.type, 'session.listed')
    const row = listing.sessions?.find((session) => session.id === sessionId)
    assert.ok(row, 'the managed Codex Session must appear in the shared Roster')

    // Codex has not written a transcript for this thread yet, so the Feed is empty rather than
    // missing: the Session screen must not read a Session it just started as lost (#2002).
    const feedReply = (await reader.readSessionFeed({
      version: 1,
      type: 'session.feed',
      requestId: 'feed-1',
      sessionId,
      delegationId: null,
      revision: null,
    })) as { type: string; rows?: unknown[] }
    assert.equal(feedReply.type, 'session.feed.read')
    assert.deepEqual(feedReply.rows, [])

    const sendReply = await sendSession(
      {
        version: 1,
        type: 'session.send',
        requestId: 'send-1',
        sessionId,
        prompt: 'Continue with the next Turn.',
      },
      { adapters, ownerCliFor: async () => 'codex' },
    )
    assert.equal(sendReply.type, 'session.accepted')
  } finally {
    driver.close()
  }
})

// #1887: the composer sends the shared rich editor's exact markdown serialization, so a Codex
// Turn must carry it unchanged all the way to the transport, code blocks, links and recognized
// references included, not a reformatted stand-in for it.
test('a Codex Turn carries the shared editor markdown to the transport verbatim', async () => {
  const echoDir = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-echo-'))
  const echoFile = path.join(echoDir, 'turns.jsonl')
  writeFileSync(echoFile, '')
  const driver = driverBackedByFixture({ env: { ARGO_CODEX_ECHO_FILE: echoFile } })
  const adapters = { codex: createCodexDriveAdapter(driver) }
  const prompt =
    'Run `bun run quality` before @argo-plugin reviews it. See [notes](https://example.com/notes).'
  try {
    const startReply = await startSession(
      {
        version: 1,
        type: 'session.start',
        requestId: 'start-3',
        cli: 'codex',
        cwd: process.cwd(),
        prompt,
      },
      adapters,
    )
    assert.equal(startReply.type, 'session.started')

    const lines = readFileSync(echoFile, 'utf8').trim().split('\n')
    assert.equal(lines.length, 1)
    assert.equal(JSON.parse(lines[0] ?? ''), prompt)
  } finally {
    driver.close()
  }
})

test('compacting a Codex Session over the real transport clears once the item completes', async () => {
  const driver = driverBackedByFixture()
  const adapters = { codex: createCodexDriveAdapter(driver) }
  try {
    const startReply = await startSession(
      {
        version: 1,
        type: 'session.start',
        requestId: 'start-4',
        cli: 'codex',
        cwd: process.cwd(),
        prompt: 'Inspect the failing test.',
      },
      adapters,
    )
    assert.equal(startReply.type, 'session.started')
    const sessionId = startReply.type === 'session.started' ? startReply.sessionId : ''

    const compactReply = await compactSession(
      { version: 1, type: 'session.compact', requestId: 'compact-1', sessionId },
      { adapters, ownerCliFor: async () => 'codex' },
    )
    assert.equal(compactReply.type, 'session.accepted')
    assert.equal(
      driver.roster().find((session) => session.id === sessionId)?.compactionStartedAt !== null,
      true,
    )

    // The fixture's contextCompaction item/completed notification arrives asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 100))

    const row = driver.roster().find((session) => session.id === sessionId)
    assert.equal(row?.compactionStartedAt, null)
  } finally {
    driver.close()
  }
})

test('a Codex transport failure surfaces an honest, visible Session state', async () => {
  const driver = driverBackedByFixture()
  const adapters = { codex: createCodexDriveAdapter(driver) }
  try {
    const startReply = await startSession(
      {
        version: 1,
        type: 'session.start',
        requestId: 'start-2',
        cli: 'codex',
        cwd: process.cwd(),
        prompt: 'Trigger a FAIL turn.',
      },
      adapters,
    )
    assert.equal(startReply.type, 'session.started')
    const sessionId = startReply.type === 'session.started' ? startReply.sessionId : ''

    // The fixture's turn/completed notification arrives asynchronously; give it a moment.
    await new Promise((resolve) => setTimeout(resolve, 100))

    const row = driver.roster().find((session) => session.id === sessionId)
    assert.equal(row?.status, 'unknown')
  } finally {
    driver.close()
  }
})
