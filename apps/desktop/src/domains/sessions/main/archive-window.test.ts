// Archive reads grow the same bounded window the Roster pages by (#2239, #2315), rather than
// reading every transcript on the machine per page.
import assert from 'node:assert/strict'
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  claudeRoot,
  writeManySessions,
} from '../../../agents/claude/integration/session-window-fixture'
import { claudeSessionSource } from '../../../agents/claude/sessions/read-sessions'
import { createInMemorySessionTicketLinkStore } from '../../tickets/main/session-links'
import { sessionArchiveListReplySchema } from '../contract/contract'
import { ARCHIVE_PAGE_LIMIT } from './archive-reads'
import { createSessionArchiveStore, sessionArchivePath } from './archive-store'
import { ROSTER_PAGE_SIZE } from './discover-transcript-sessions'
import { createSessionReader } from './reader'

const ROOT_ID = 'archivedRoot'
const RESUMED_ID = 'resumedFromArchivedRoot'

async function archiveOf(
  context: { after: (cleanup: () => Promise<void>) => void },
  archivedIds: string[],
) {
  const store = await mkdtemp(path.join(os.tmpdir(), 'argo-archive-window-'))
  context.after(() => rm(store, { recursive: true, force: true }))
  const archive = createSessionArchiveStore(sessionArchivePath(store))
  await archive.setArchived(archivedIds, true)
  return archive
}

function readerOver(transcripts: string, archive: ReturnType<typeof createSessionArchiveStore>) {
  return createSessionReader(
    [claudeSessionSource({ transcripts })],
    createInMemorySessionTicketLinkStore(),
    archive,
  )
}

async function archivePage(
  reader: ReturnType<typeof createSessionReader>,
  options: { cursor?: string | null; restoreId?: string | null; requestId: string },
) {
  const reply = sessionArchiveListReplySchema.parse(
    await reader.archiveList({
      version: 1,
      type: 'session.archive.list',
      requestId: options.requestId,
      cursor: options.cursor ?? null,
      restoreId: options.restoreId ?? null,
    }),
  )
  return reply.type === 'session.archive.listed' ? reply : assert.fail(`unexpected: ${reply.type}`)
}

test('pages the Archive within a bounded window rather than reading the whole tree per page', async (context) => {
  const root = await claudeRoot(context)
  await writeManySessions(root, ROSTER_PAGE_SIZE + 10)
  const archived = Array.from({ length: ROSTER_PAGE_SIZE + 10 }, (_, index) => `s${index}`)
  const reader = readerOver(root, await archiveOf(context, archived))

  const first = await archivePage(reader, { requestId: 'archive-list-1' })
  assert.equal(first.sessions.length, ARCHIVE_PAGE_LIMIT)
  assert.notEqual(first.nextCursor, null)

  const second = await archivePage(reader, {
    requestId: 'archive-list-2',
    cursor: first.nextCursor,
  })
  assert.equal(second.sessions.length, ARCHIVE_PAGE_LIMIT)
  const ids = [...first.sessions, ...second.sessions].map((row) => row.id)
  assert.equal(new Set(ids).size, ids.length)
})

// The root Session, archived under `ROOT_ID`, and the later resume that retired it: the resume's
// file is the newest of all so it is always in-window, while the root's own file sits far outside
// it, older than every filler Session `writeManySessions` writes.
async function writeResumedChain(root: string) {
  const rootFile = path.join(root, 'project-one', `${ROOT_ID}.jsonl`)
  const rootAt = '2026-01-01T00:00:00.000Z'
  await writeFile(
    rootFile,
    `${JSON.stringify({
      type: 'assistant',
      uuid: `${ROOT_ID}-a`,
      timestamp: rootAt,
      cwd: '/proj',
      message: {
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Original work.' }],
      },
    })}\n`,
  )
  await utimes(rootFile, new Date(rootAt), new Date(rootAt))

  const resumedFile = path.join(root, 'project-one', `${RESUMED_ID}.jsonl`)
  const resumedAt = '2026-09-13T13:00:00.000Z'
  await writeFile(
    resumedFile,
    [
      { type: 'last-prompt', leafUuid: `${ROOT_ID}-a` },
      {
        type: 'assistant',
        uuid: `${RESUMED_ID}-a`,
        timestamp: resumedAt,
        cwd: '/proj',
        message: {
          role: 'assistant',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Resumed.' }],
        },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n'),
  )
  await utimes(resumedFile, new Date(resumedAt), new Date(resumedAt))
}

// The store still names the id that was current when the reader archived it: finding it by the id
// it resumed under proves restore-by-id grows the loaded window rather than only ever answering
// from the first page (#2239).
test('finds a Session archived under a retired id, by growing past the currently loaded Archive pages', async (context) => {
  const root = await claudeRoot(context)
  // Filler recent enough to fill the first bounded window, pushing the archived chain's root
  // file outside it.
  await writeManySessions(root, ROSTER_PAGE_SIZE + 10)
  await writeResumedChain(root)
  // Archived while `ROOT_ID` was still the current id, before the later resume retired it.
  const reader = readerOver(root, await archiveOf(context, [ROOT_ID]))

  const archived = await archivePage(reader, {
    requestId: 'archive-list-3',
    restoreId: RESUMED_ID,
  })

  assert.equal(archived.restored?.id, ROOT_ID)
  assert.ok(archived.restored?.retiredIds.includes(RESUMED_ID))
})
