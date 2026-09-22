// The shared discovery engine's bounded window and cursor (#2239), proven against a minimal mock
// Harness rather than either real adapter.
import assert from 'node:assert/strict'
import { appendFile, utimes } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import {
  mockDiscoverer,
  mockRoot,
  writeManySessions,
  writeMockTranscript,
} from '../../../../../../mocks/sessions/mock-discover-transcript-sessions'
import { ROSTER_PAGE_SIZE } from './discover-transcript-sessions'

const LATER = '2026-09-13T12:05:00.000Z'

test('reads only the bounded window on a cold cursor, even when more files exist', async (context) => {
  const root = await mockRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 20)
  const { discoverSessions } = mockDiscoverer()

  const reply = await discoverSessions(root)
  assert.equal(reply.filesFound, ROSTER_PAGE_SIZE + 20)
  assert.equal(reply.filesRead, ROSTER_PAGE_SIZE)
  assert.equal(reply.rows.length, ROSTER_PAGE_SIZE)
  assert.notEqual(reply.nextCursor, null)
})

test('states no continuation once every file is inside the window', async (context) => {
  const root = await mockRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE - 5)
  const { discoverSessions } = mockDiscoverer()

  const reply = await discoverSessions(root)
  assert.equal(reply.filesRead, ROSTER_PAGE_SIZE - 5)
  assert.equal(reply.nextCursor, null)
})

test('a later request echoing nextCursor reads the Sessions the first page missed', async (context) => {
  const root = await mockRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 20)
  const { discoverSessions } = mockDiscoverer()

  const first = await discoverSessions(root)
  const ids = first.rows.map((row) => row.id)
  assert.ok(!ids.includes(`s${ROSTER_PAGE_SIZE + 10}`))

  const second = await discoverSessions(root, { cursor: first.nextCursor })
  assert.equal(second.filesRead, ROSTER_PAGE_SIZE + 20)
  assert.equal(second.nextCursor, null)
  assert.ok(second.rows.map((row) => row.id).includes(`s${ROSTER_PAGE_SIZE + 10}`))
})

test('a grown window still carries every row the smaller one already returned, newest first', async (context) => {
  const root = await mockRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 20)
  const { discoverSessions } = mockDiscoverer()

  const first = await discoverSessions(root)
  const second = await discoverSessions(root, { cursor: first.nextCursor })
  const secondIds = second.rows.map((row) => row.id)

  for (const row of first.rows) assert.ok(secondIds.includes(row.id))
  assert.deepEqual(
    secondIds,
    [...secondIds].sort((a, b) => secondIds.indexOf(a) - secondIds.indexOf(b)),
  )
  assert.equal(new Set(secondIds).size, secondIds.length)
  assert.deepEqual(
    second.rows.map((row) => row.updatedAt),
    [...second.rows.map((row) => row.updatedAt)].sort((a, b) => (b ?? '').localeCompare(a ?? '')),
  )
})

test('finds a Session outside the initial window by growing until it resolves', async (context) => {
  const root = await mockRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 20)
  const { readSessionFiles } = mockDiscoverer()

  const targetId = `s${ROSTER_PAGE_SIZE + 10}`
  const chain = await readSessionFiles(root, targetId)
  assert.ok(chain !== null)
  assert.equal(chain?.id, targetId)
})

test('reports a Session no window can find as absent rather than growing forever', async (context) => {
  const root = await mockRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE - 5)
  const { readSessionFiles } = mockDiscoverer()

  assert.equal(await readSessionFiles(root, 'never-written'), null)
})

// A Session Argo just started has no transcript yet, and every Feed poll asks for it (#2356).
test('answers a Session no transcript is named for without reading a transcript', async (context) => {
  const root = await mockRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 20)
  const read: string[] = []
  const { readSessionFiles } = mockDiscoverer((line) => read.push(line))

  assert.equal(await readSessionFiles(root, 'not-written-yet'), null)
  assert.equal(read.length, 0)
})

// A Harness can append a Turn inside one mtime tick, and on a coarse-timestamp filesystem the file
// then reads as untouched. The Roster must still follow it (#2241).
test('follows a transcript appended to without its mtime moving', async (context) => {
  const root = await mockRoot(context)
  const writtenAt = '2026-09-13T12:00:00.000Z'
  await writeMockTranscript({ root, sessionId: 'grows', writtenAt })
  const { discoverSessions } = mockDiscoverer()

  const first = await discoverSessions(root)
  const file = path.join(root, 'grows.jsonl')
  await appendFile(file, `${JSON.stringify({ uuid: 'later', timestamp: LATER })}\n`)
  const at = new Date(writtenAt)
  await utimes(file, at, at)

  const grown = await discoverSessions(root)
  assert.notEqual(grown.rows[0]?.updatedAt, first.rows[0]?.updatedAt)
  assert.equal(grown.rows[0]?.updatedAt, LATER)
})
