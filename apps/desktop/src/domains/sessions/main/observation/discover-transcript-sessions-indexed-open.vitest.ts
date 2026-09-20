// Opening one Session must cost the size of its own chain, not the size of the whole transcript
// tree (#2507). Node runs this for the same reason `backfill-window.vitest.ts` does: the Session
// index reaches `node:sqlite`, which Bun does not ship.
import { appendFile, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { openSessionIndex } from '@/domains/sessions/main/index/session-index/open-index'
import {
  mockDiscoverer,
  writeManySessions,
  writeMockTranscript,
} from '../../../../../mocks/sessions/mock-discover-transcript-sessions'
import { ROSTER_PAGE_SIZE } from './discover-transcript-sessions'

const cleanUp: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanUp.splice(0)) await close()
})

async function openIndex() {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-session-open-index-'))
  cleanUp.push(() => rm(folder, { recursive: true, force: true }))
  const index = openSessionIndex(path.join(folder, 'sessions.db'))
  cleanUp.push(async () => index.close())
  return index
}

async function transcriptRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-discover-'))
  cleanUp.push(() => rm(root, { recursive: true, force: true }))
  return root
}

async function indexedDiscoverer(root: string, onLine?: (line: string) => void) {
  const index = await openIndex()
  const discoverer = mockDiscoverer(onLine)
  await discoverer.discoverSessions(root, { index })
  let progress = await discoverer.backfillTick(root, index)
  while (!progress.complete) progress = await discoverer.backfillTick(root, index)
  return { ...discoverer, index }
}

test('opens an indexed Session without reading the rest of the tree', async () => {
  const root = await transcriptRoot()
  await writeManySessions(root, ROSTER_PAGE_SIZE * 3 + 20)
  const read: string[] = []
  const { index, readSessionFiles } = await indexedDiscoverer(root, (line) => read.push(line))

  const targetId = `s${ROSTER_PAGE_SIZE * 3}`
  read.length = 0
  const chain = await readSessionFiles(root, targetId, index)

  expect(chain?.id).toBe(targetId)
  // The chain is one file of one line, read as two parser calls (the line and the trailing
  // blank past the file's final newline). A tree-paging read would have grown its window past
  // `ROSTER_PAGE_SIZE * 3` to reach it, reading every file's lines along the way.
  expect(read.length).toBe(2)
}, 20_000)

test('opens a changed indexed Session without parsing its chain twice', async () => {
  const root = await transcriptRoot()
  await writeMockTranscript({ root, sessionId: 'changed', writtenAt: '2026-09-13T12:00:00.000Z' })
  const read: string[] = []
  const { index, readSessionFiles } = await indexedDiscoverer(root, (line) => read.push(line))

  await appendFile(
    path.join(root, 'changed.jsonl'),
    `${JSON.stringify({ uuid: 'later', timestamp: '2026-09-13T12:01:00.000Z' })}\n`,
  )
  read.length = 0

  const chain = await readSessionFiles(root, 'changed', index)

  expect(chain?.files[0]?.records).toHaveLength(2)
  expect(read.length).toBe(2)
})

test('follows a chain the index knows under a retired id back to its origin', async () => {
  const root = await transcriptRoot()
  await writeMockTranscript({ root, sessionId: 'origin', writtenAt: '2026-09-13T12:00:00.000Z' })
  await writeMockTranscript({
    root,
    sessionId: 'resumed',
    writtenAt: '2026-09-13T12:05:00.000Z',
    origin: 'origin',
  })
  const { index, readSessionFiles } = await indexedDiscoverer(root)

  const chain = await readSessionFiles(root, 'resumed', index)
  expect(chain?.id).toBe('origin')
  expect(chain?.files.map((file) => file.sessionId)).toEqual(['origin', 'resumed'])
})

test('falls back to paging a Session the index has not backfilled yet', async () => {
  const root = await transcriptRoot()
  await writeManySessions(root, ROSTER_PAGE_SIZE + 5)
  const index = await openIndex()
  const { readSessionFiles } = mockDiscoverer()

  const targetId = `s${ROSTER_PAGE_SIZE}`
  const chain = await readSessionFiles(root, targetId, index)

  expect(chain?.id).toBe(targetId)
})

describe('when no index is available', () => {
  test('reads the tree exactly as before', async () => {
    const root = await transcriptRoot()
    await writeManySessions(root, ROSTER_PAGE_SIZE + 20)
    const { readSessionFiles } = mockDiscoverer()

    const targetId = `s${ROSTER_PAGE_SIZE + 10}`
    const chain = await readSessionFiles(root, targetId)

    expect(chain?.id).toBe(targetId)
  })
})
