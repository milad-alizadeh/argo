// A resumed Session can be archived under an id it has since retired (#1593), split out of
// session-discover-window.test.ts to keep that file under the line cap.
import assert from 'node:assert/strict'
import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { ROSTER_PAGE_SIZE } from '@/core/sessions/discover-transcript-sessions'
import { createClaudeSessionReader } from '../sessions/read-sessions.ts'
import { writeArchiveStore } from './session-fixture-files'
import { claudeRoot, writeManySessions } from './session-window-fixture'

const ROOT_ID = 'archivedRoot'
const RESUMED_ID = 'resumedFromArchivedRoot'

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

// The store still names the id that was current when it archived it: finding it by the id it
// resumed under proves restore-by-id grows the loaded window rather than only ever answering
// from the first page (#2239).
test('finds a Session archived under a retired id, by growing past the currently loaded Archive pages', async (context) => {
  const root = await claudeRoot(context)
  // Filler recent enough to fill the first bounded window, pushing the archived chain's root
  // file outside it.
  await writeManySessions(root, ROSTER_PAGE_SIZE + 10)
  await writeResumedChain(root)

  const store = await mkdtemp(path.join(os.tmpdir(), 'argo-archive-retired-'))
  context.after(() => rm(store, { recursive: true, force: true }))
  // Archived while `ROOT_ID` was still the current id, before the later resume retired it.
  await writeArchiveStore(store, [ROOT_ID], { archived: true })
  const reader = createClaudeSessionReader({ transcripts: root, archive: store })

  const archived = await reader.archiveList({
    version: 1,
    type: 'session.archive.list',
    requestId: 'archive-list-3',
    cursor: null,
    restoreId: RESUMED_ID,
  })
  assert.equal(archived.type, 'session.archive.listed')
  assert.ok(archived.type === 'session.archive.listed' && archived.restored?.id === ROOT_ID)
  assert.ok(
    archived.type === 'session.archive.listed' &&
      archived.restored?.retiredIds.includes(RESUMED_ID),
  )
})
