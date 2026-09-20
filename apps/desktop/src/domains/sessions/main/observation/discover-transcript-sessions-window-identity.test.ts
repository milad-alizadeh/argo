// #2290: an unrelated Session's writes push a resumed Session's origin file in and out of the
// bounded window on every poll, with no real change to that Session at all. Its id and title
// must stay put regardless.
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { ROSTER_PAGE_SIZE } from '@/domains/sessions/main/observation/discover-transcript-sessions'
import {
  mockDiscoverer,
  mockRoot,
  writeMockTranscript,
} from '../../../../../mocks/sessions/mock-discover-transcript-sessions'

test('a resumed Session keeps its id and title as its origin file moves out of the window and back', async (context) => {
  const root = await mockRoot(context)
  const { discoverSessions } = mockDiscoverer()
  const base = Date.parse('2026-09-13T12:00:00.000Z')

  await writeMockTranscript({
    root,
    sessionId: 'origin',
    writtenAt: new Date(base - 3_600_000).toISOString(),
    title: { text: 'Renamed by hand', source: 'custom' },
  })
  await writeMockTranscript({
    root,
    sessionId: 'resumed',
    writtenAt: new Date(base).toISOString(),
    origin: 'origin',
  })
  for (let index = 0; index < ROSTER_PAGE_SIZE - 2; index += 1) {
    const writtenAt = new Date(base - 1_800_000 - index * 1_000).toISOString()
    await writeMockTranscript({ root, sessionId: `filler${index}`, writtenAt })
  }

  function chainRow(rows: Awaited<ReturnType<typeof discoverSessions>>['rows']) {
    return rows.find((row) => row.id === 'origin' || row.retiredIds.includes('resumed'))
  }

  const first = chainRow((await discoverSessions(root)).rows)
  assert.equal(first?.id, 'origin')
  assert.deepEqual(first?.title, { text: 'Renamed by hand', source: 'custom' })
  assert.equal(first?.originUnread, false)

  // One more, newer filler pushes `origin`, the oldest file in the chain, past the window
  // boundary. Nothing about the resumed Session itself changed.
  await writeMockTranscript({
    root,
    sessionId: 'pushesOriginOut',
    writtenAt: new Date(base - 1_700_000).toISOString(),
  })
  const second = chainRow((await discoverSessions(root)).rows)
  assert.equal(second?.id, 'origin')
  assert.deepEqual(second?.title, { text: 'Renamed by hand', source: 'custom' })
  assert.equal(second?.originUnread, true)

  await rm(path.join(root, 'pushesOriginOut.jsonl'))
  const third = chainRow((await discoverSessions(root)).rows)
  assert.equal(third?.id, 'origin')
  assert.deepEqual(third?.title, { text: 'Renamed by hand', source: 'custom' })
  assert.equal(third?.originUnread, false)
})
