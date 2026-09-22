import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { test } from 'node:test'
import { sessionArchiveSetReplySchema } from '@/domains/sessions/contract/ipc/contract'
import {
  createSessionArchiveStore,
  sessionArchivePath,
} from '@/domains/sessions/main/archive/archive-store'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import {
  listed,
  tempRoot,
  writeClaudeTranscript,
} from '@/domains/sessions/main/observation/reader-test-helpers'
import { createInMemorySessionTicketLinkStore } from '@/domains/tickets/main'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions'

// `failed` is a storage failure alone (#2315): the flag is Argo's own, so the only reason a
// Session cannot be archived is that its document does not get written. A directory where the
// document belongs is a real failure because the atomic rename cannot land on it.
test('reports every named Session failed when the archive cannot be written', async (context) => {
  const claudeRoot = await tempRoot(context)
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'claudeOne',
    text: 'From Claude.',
    updatedAt: '2026-09-13T10:00:00.000Z',
  })
  const unwritable = sessionArchivePath(await tempRoot(context))
  await mkdir(unwritable, { recursive: true })
  const reader = createSessionReader(
    [claudeSessionSource({ transcripts: claudeRoot })],
    createInMemorySessionTicketLinkStore(),
    createSessionArchiveStore(unwritable),
  )

  const reply = sessionArchiveSetReplySchema.parse(
    await reader.archiveSet({
      version: 1,
      type: 'session.archive.set',
      requestId: 'archive-set-1',
      sessionIds: ['claudeOne'],
      archived: true,
    }),
  )

  assert.equal(reply.type, 'session.archive.applied')
  assert.deepEqual(reply.applied, [])
  assert.deepEqual(reply.failed, ['claudeOne'])
  assert.deepEqual(
    (await listed(reader, 'list-2'))?.sessions.map((row) => row.id),
    ['claudeOne'],
  )
})
