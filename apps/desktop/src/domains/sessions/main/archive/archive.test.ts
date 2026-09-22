// Archiving through the shared reader (#2315): one Argo-owned flag, the same path for every Harness.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionArchiveSetReplySchema } from '@/domains/sessions/contract/ipc/contract'
import { createSessionReader } from '../observation/reader'
import {
  listed,
  tempRoot,
  writeClaudeTranscript,
  writeCodexTranscript,
} from '../observation/reader-test-helpers'
import { createInMemorySessionTicketLinkStore } from '@/domains/tickets/main'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'
import { requestArchiveList } from './archive-list-request'
import { createSessionArchiveStore, sessionArchivePath } from './archive-store'

type Context = { after: (cleanup: () => Promise<void>) => void }

async function twoHarnessReader(context: Context) {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  const userData = await tempRoot(context)
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'claudeOne',
    text: 'From Claude.',
    updatedAt: '2026-09-13T10:00:00.000Z',
  })
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'codexOne',
    text: 'From Codex.',
    updatedAt: '2026-09-13T11:00:00.000Z',
  })
  const archive = createSessionArchiveStore(sessionArchivePath(userData))
  const reader = createSessionReader(
    [claudeSessionSource({ transcripts: claudeRoot }), codexSessionSource(codexRoot)],
    createInMemorySessionTicketLinkStore(),
    archive,
  )
  return { reader, archive }
}

async function setArchived(
  reader: Awaited<ReturnType<typeof twoHarnessReader>>['reader'],
  sessionIds: string[],
  change: { archived: boolean; requestId?: string },
) {
  const reply = sessionArchiveSetReplySchema.parse(
    await reader.archiveSet({
      version: 1,
      type: 'session.archive.set',
      requestId: change.requestId ?? 'archive-set-1',
      sessionIds,
      archived: change.archived,
    }),
  )
  assert.equal(reply.type, 'session.archive.applied')
  return reply.type === 'session.archive.applied' ? reply : assert.fail('not applied')
}

async function archiveList(
  reader: Awaited<ReturnType<typeof twoHarnessReader>>['reader'],
  options: { cursor?: string | null; restoreId?: string | null; requestId?: string } = {},
) {
  const reply = await requestArchiveList(reader, options)
  assert.equal(reply.type, 'session.archive.listed')
  return reply.type === 'session.archive.listed' ? reply : assert.fail('not listed')
}

test('archives a Codex Session and restores it, through the same path a Claude Session takes', async (context) => {
  const { reader } = await twoHarnessReader(context)

  const applied = await setArchived(reader, ['codexOne'], { archived: true })

  assert.deepEqual(applied.applied, ['codexOne'])
  assert.deepEqual(applied.failed, [])
  assert.deepEqual(
    (await listed(reader, 'list-2'))?.sessions.map((row) => row.id),
    ['claudeOne'],
  )
  assert.deepEqual(
    (await archiveList(reader)).sessions.map((row) => row.id),
    ['codexOne'],
  )

  await setArchived(reader, ['codexOne'], { archived: false, requestId: 'archive-set-2' })

  assert.deepEqual((await listed(reader, 'list-3'))?.sessions.map((row) => row.id).sort(), [
    'claudeOne',
    'codexOne',
  ])
})

test('lists archived Sessions from every harness in one page', async (context) => {
  const { reader } = await twoHarnessReader(context)

  await setArchived(reader, ['claudeOne', 'codexOne'], { archived: true })

  const page = await archiveList(reader)
  assert.deepEqual(
    page.sessions.map((row) => row.id),
    ['codexOne', 'claudeOne'],
  )
  assert.ok(page.sessions.every((row) => row.archived))
  assert.equal(page.nextCursor, null)
})

test('archives a Session Argo has never discovered, writing its own row', async (context) => {
  const { reader, archive } = await twoHarnessReader(context)

  const applied = await setArchived(reader, ['neverDiscovered'], { archived: true })

  assert.deepEqual(applied.applied, ['neverDiscovered'])
  assert.deepEqual(applied.failed, [])
  assert.ok((await archive.archivedIds()).has('neverDiscovered'))
})

test('archives on a machine with no other agent app installed', async (context) => {
  const claudeRoot = await tempRoot(context)
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'claudeOne',
    text: 'From Claude.',
    updatedAt: '2026-09-13T10:00:00.000Z',
  })
  const userData = await tempRoot(context)
  const reader = createSessionReader(
    [claudeSessionSource({ transcripts: claudeRoot })],
    createInMemorySessionTicketLinkStore(),
    createSessionArchiveStore(sessionArchivePath(userData)),
  )

  await setArchived(reader, ['claudeOne'], { archived: true })

  assert.deepEqual(
    (await listed(reader, 'list-2'))?.sessions.map((row) => row.id),
    [],
  )
})
