import assert from 'node:assert/strict'
import { appendFile, mkdir, readdir, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import type { SessionReader } from '@/domains/sessions/main/composition/bridge'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import {
  listed,
  tempRoot,
  writeClaudeTranscript,
} from '@/domains/sessions/main/observation/reader/reader-test-helpers'
import { startedSession } from '@/harnesses/claude/integration/claude-driver-launch.ts'
import { claudeSessionSource } from '@/harnesses/claude/sessions/discovery/read-sessions'

const SESSION = 'session-a'
const MINUTE = 60_000

function at(offset: number) {
  return new Date(Date.now() + offset)
}

async function compactingSession(context: TestContext, startedAt = at(-MINUTE)) {
  const transcripts = await tempRoot(context)
  const starts = await tempRoot(context)
  const lastTurn = new Date(startedAt.getTime() - 10_000)
  await writeClaudeTranscript({
    root: transcripts,
    sessionId: SESSION,
    text: 'Done.',
    updatedAt: lastTurn.toISOString(),
  })
  await mkdir(starts, { recursive: true })
  const start = path.join(starts, '4242.json')
  await writeFile(start, JSON.stringify({ session_id: SESSION, hook_event_name: 'PreCompact' }))
  await utimes(start, startedAt, startedAt)
  const reader = createSessionReader([
    claudeSessionSource({ transcripts, compactionStarts: starts }),
  ])
  return { transcripts, starts, reader, startedAt }
}

// The Harness adding a record the reader has already seen the file without.
async function append(transcripts: string, record: Record<string, unknown>) {
  const file = path.join(transcripts, 'project-one', `${SESSION}.jsonl`)
  await appendFile(file, `${JSON.stringify(record)}\n`)
  await utimes(file, at(MINUTE), at(MINUTE))
}

async function compactionStartedAt(reader: SessionReader) {
  const reply = await listed(reader)
  const row = reply?.sessions.find((session) => session.id === SESSION)
  assert.ok(row, 'The Session is missing from the Roster.')
  return row.compactionStartedAt ?? null
}

test('an outside Session reads compacting from the moment its hook saw the start', async (context) => {
  const { reader, startedAt } = await compactingSession(context)
  assert.equal(await compactionStartedAt(reader), startedAt.toISOString())
})

test('a compact boundary after the start ends the compaction and removes its start file', async (context) => {
  const { reader, transcripts, starts, startedAt } = await compactingSession(context)
  await append(transcripts, {
    type: 'system',
    subtype: 'compact_boundary',
    uuid: 'boundary-1',
    timestamp: new Date(startedAt.getTime() + 72_000).toISOString(),
  })
  assert.equal(await compactionStartedAt(reader), null)
  assert.deepEqual(await readdir(starts), [])
})

function messageAfter(startedAt: Date, role: 'user' | 'assistant') {
  return {
    type: role,
    uuid: `${role}-after`,
    timestamp: new Date(startedAt.getTime() + 5_000).toISOString(),
    message: { role, stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hi' }] },
  }
}

test('a message after the start ends a compaction that was interrupted', async (context) => {
  for (const role of ['user', 'assistant'] as const) {
    const { reader, transcripts, startedAt } = await compactingSession(context)
    await append(transcripts, messageAfter(startedAt, role))
    assert.equal(await compactionStartedAt(reader), null, role)
  }
})

test('a Session Argo drives stops compacting when the person interrupts it in the terminal', async (context) => {
  const { transcripts, starts, startedAt } = await compactingSession(context)
  const { driver } = await startedSession(context, { mintSessionId: () => SESSION })
  const source = { transcripts, compactionStarts: starts, managedSessions: driver.roster }
  const reader = createSessionReader([
    claudeSessionSource({
      ...source,
      beginCompaction: driver.beginCompaction,
      completeCompaction: driver.completeCompaction,
    }),
  ])

  await listed(reader)
  await append(transcripts, messageAfter(startedAt, 'user'))
  await listed(reader)

  assert.equal(driver.roster()[0]?.compactionStartedAt, null)
})

test('a Session Argo drives shows the percentage its terminal paints once the hook sees the start', async (context) => {
  const { transcripts, starts, startedAt } = await compactingSession(context)
  const { driver, paint } = await startedSession(context, { mintSessionId: () => SESSION })
  const reader = createSessionReader([
    claudeSessionSource({
      transcripts,
      compactionStarts: starts,
      managedSessions: driver.roster,
      beginCompaction: driver.beginCompaction,
      completeCompaction: driver.completeCompaction,
    }),
  ])

  await listed(reader)
  paint(0, 'Compacting conversation… (0m 40s · ↓ 3.2k tokens) 40%\r\n')
  const row = (await listed(reader))?.sessions.find((session) => session.id === SESSION)

  assert.deepEqual(
    { startedAt: row?.compactionStartedAt, percentage: row?.compactionPercentage },
    { startedAt: startedAt.toISOString(), percentage: 40 },
  )
})

test('a compaction start left by a Session that died mid-compaction stops reading as compacting', async (context) => {
  const { reader, starts } = await compactingSession(context, at(-120 * MINUTE))
  assert.equal(await compactionStartedAt(reader), null)
  assert.deepEqual(await readdir(starts), [])
})
