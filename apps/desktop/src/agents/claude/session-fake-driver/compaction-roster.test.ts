import assert from 'node:assert/strict'
import { appendFile, mkdir, readdir, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { createSessionReader } from '@/core/sessions/reader'
import { listed, tempRoot, writeClaudeTranscript } from '@/core/sessions/reader-test-helpers'
import { claudeSessionSource, createClaudeSessionReader } from '../sessions/read-sessions'
import { startedSession } from './claude-driver-launch.ts'

const SESSION = 'session-a'
const MINUTE = 60_000

function at(offset: number) {
  return new Date(Date.now() + offset)
}

async function compactingSession(context: TestContext, startedAt = at(-MINUTE)) {
  const transcripts = await tempRoot(context)
  const markers = await tempRoot(context)
  const lastTurn = new Date(startedAt.getTime() - 10_000)
  await writeClaudeTranscript({
    root: transcripts,
    sessionId: SESSION,
    text: 'Done.',
    updatedAt: lastTurn.toISOString(),
  })
  await mkdir(markers, { recursive: true })
  const marker = path.join(markers, '4242.json')
  await writeFile(marker, JSON.stringify({ session_id: SESSION, hook_event_name: 'PreCompact' }))
  await utimes(marker, startedAt, startedAt)
  const reader = createClaudeSessionReader({ transcripts, compactionMarkers: markers })
  return { transcripts, markers, reader, startedAt }
}

// The CLI adding a record the reader has already seen the file without.
async function append(transcripts: string, record: Record<string, unknown>) {
  const file = path.join(transcripts, 'project-one', `${SESSION}.jsonl`)
  await appendFile(file, `${JSON.stringify(record)}\n`)
  await utimes(file, at(MINUTE), at(MINUTE))
}

async function compactionStartedAt(reader: ReturnType<typeof createClaudeSessionReader>) {
  const reply = await listed(reader)
  const row = reply?.sessions.find((session) => session.id === SESSION)
  assert.ok(row, 'The Session is missing from the Roster.')
  return row.compactionStartedAt ?? null
}

test('an outside Session reads compacting from the moment its hook marked the start', async (context) => {
  const { reader, startedAt } = await compactingSession(context)
  assert.equal(await compactionStartedAt(reader), startedAt.toISOString())
})

test('a compact boundary after the start ends the compaction and removes its marker', async (context) => {
  const { reader, transcripts, markers, startedAt } = await compactingSession(context)
  await append(transcripts, {
    type: 'system',
    subtype: 'compact_boundary',
    uuid: 'boundary-1',
    timestamp: new Date(startedAt.getTime() + 72_000).toISOString(),
  })
  assert.equal(await compactionStartedAt(reader), null)
  assert.deepEqual(await readdir(markers), [])
})

test('a reply after the start ends a compaction that was interrupted', async (context) => {
  const { reader, transcripts, startedAt } = await compactingSession(context)
  await append(transcripts, {
    type: 'assistant',
    uuid: 'reply-after',
    timestamp: new Date(startedAt.getTime() + 5_000).toISOString(),
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Hi' }],
    },
  })
  assert.equal(await compactionStartedAt(reader), null)
})

test('a Session Argo drives shows the percentage its terminal paints once the hook marks the start', async (context) => {
  const { transcripts, markers, startedAt } = await compactingSession(context)
  const { driver, paint } = await startedSession(context, { mintSessionId: () => SESSION })
  const reader = createSessionReader([
    claudeSessionSource({
      transcripts,
      compactionMarkers: markers,
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

test('a marker left by a Session that died mid-compaction stops reading as compacting', async (context) => {
  const { reader, markers } = await compactingSession(context, at(-120 * MINUTE))
  assert.equal(await compactionStartedAt(reader), null)
  assert.deepEqual(await readdir(markers), [])
})
