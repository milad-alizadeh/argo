// The #1839 vertical slice, driven end to end over a real child process and real stdio pipes: a
// fixture app-server (fixtures/fake-codex-app-server.ts) stands in for `codex app-server`, so this
// proves the wire framing and the driver together, not just an in-memory fake of `CodexChannel`.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { sendSession, startSession } from '@/core/sessions/drive.ts'
import { openCodexChannel } from '../drive/codex-channel.ts'
import { createCodexSessionDriver } from '../drive/codex-session-driver.ts'
import { createCodexDriveAdapter } from '../drive/session-drive-adapter.ts'
import { createCodexSessionReader } from '../sessions/read-sessions.ts'

const fixture = fileURLToPath(new URL('./fixtures/fake-codex-app-server.ts', import.meta.url))

function driverBackedByFixture() {
  return createCodexSessionDriver({
    findExecutable: () => process.execPath,
    now: () => new Date(),
    openChannel: (executable, options) => {
      const child = spawn(executable, [fixture], { cwd: options.cwd, env: options.env })
      child.stderr.on('data', () => {})
      return openCodexChannel({
        stdout: child.stdout,
        write: (line) => child.stdin.write(line),
        kill: () => child.kill(),
        onExit: (listener) => {
          child.on('close', listener)
          child.on('error', listener)
        },
      })
    },
  })
}

async function ownerCliFor() {
  return 'codex'
}

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
    const reader = createCodexSessionReader(transcripts, { roster: driver.roster })
    const listing = (await reader.listSessions({
      version: 1,
      type: 'session.list',
      requestId: 'list-1',
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
      adapters,
      ownerCliFor,
    )
    assert.equal(sendReply.type, 'session.accepted')
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

test('driving a Session Codex never launched reports a drivable failure, not a stall', async () => {
  const driver = driverBackedByFixture()
  const adapters = { codex: createCodexDriveAdapter(driver) }
  const reply = await sendSession(
    {
      version: 1,
      type: 'session.send',
      requestId: 'send-2',
      sessionId: 'never-started',
      prompt: 'x',
    },
    adapters,
    ownerCliFor,
  )
  assert.equal(reply.type, 'session.error')
  assert.equal(reply.code, 'not-drivable')
})

test('Codex being unavailable on the machine reports an honest start failure', async () => {
  const driver = createCodexSessionDriver({
    findExecutable: () => null,
    now: () => new Date(),
    openChannel: () => {
      throw new Error('unreachable')
    },
  })
  const adapters = { codex: createCodexDriveAdapter(driver) }
  const reply = await startSession(
    {
      version: 1,
      type: 'session.start',
      requestId: 'start-3',
      cli: 'codex',
      cwd: process.cwd(),
      prompt: 'Inspect the failing test.',
    },
    adapters,
  )
  assert.equal(reply.type, 'session.error')
  assert.equal(reply.code, 'cli-unavailable')
})
