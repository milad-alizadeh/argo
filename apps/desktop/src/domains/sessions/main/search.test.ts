// Searching title and Session id across every harness, through the shared reader (#2375). No
// Session index is open here, so every case exercises the window-growing fallback
// (`archive-window.ts`); `search-index.vitest.ts` proves the index-backed path instead.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { sessionArchiveSetReplySchema } from '@/domains/sessions/contract/contract'
import {
  createSessionArchiveStore,
  sessionArchivePath,
} from '@/domains/sessions/main/archive-store'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { indexedAdapters, sessionIdAt } from '@/domains/sessions/main/session-index/roster-fixtures'
import { createInMemorySessionTicketLinkStore } from '@/domains/tickets/main/session-links'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'

function adapter(harness: string) {
  const found = indexedAdapters.find((candidate) => candidate.harness === harness)
  if (found === undefined) throw new Error(`missing ${harness} adapter fixture`)
  return found
}

const claude = adapter('claude')
const codex = adapter('codex')

const CLAUDE_ONE = sessionIdAt(1)
const CODEX_ONE = sessionIdAt(2)

type Context = { after: (cleanup: () => Promise<void>) => void }

async function tempRoot(context: Context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-search-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return root
}

async function twoHarnessReader(context: Context) {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  const userData = await tempRoot(context)
  await claude.write(claudeRoot, [
    {
      id: CLAUDE_ONE,
      prompt: 'Rename the shortcut table.',
      cwd: '/repo/argo',
      at: '2026-09-13T10:00:00.000Z',
    },
  ])
  await codex.write(codexRoot, [
    {
      id: CODEX_ONE,
      prompt: 'Fix the Archive pagination bug.',
      cwd: '/repo/other',
      at: '2026-09-13T11:00:00.000Z',
    },
  ])
  const archive = createSessionArchiveStore(sessionArchivePath(userData))
  const reader = createSessionReader(
    [claudeSessionSource({ transcripts: claudeRoot }), codexSessionSource(codexRoot)],
    createInMemorySessionTicketLinkStore(),
    archive,
  )
  return { reader, archive }
}

async function search(
  reader: Awaited<ReturnType<typeof twoHarnessReader>>['reader'],
  query: string,
  options: { status?: 'active' | 'archived' | 'all'; projectRoot?: string | null } = {},
) {
  const reply = await reader.search({
    version: 1,
    type: 'session.search',
    requestId: 'search-1',
    projectRoot: options.projectRoot ?? null,
    status: options.status ?? 'active',
    query,
    cursor: null,
  })
  assert.equal(reply.type, 'session.searched')
  return reply.type === 'session.searched' ? reply : assert.fail('not searched')
}

test('finds a Session outside its own harness by a title substring, case-insensitively', async (context) => {
  const { reader } = await twoHarnessReader(context)

  const page = await search(reader, 'archive PAGINATION')

  assert.deepEqual(
    page.sessions.map((row) => row.id),
    [CODEX_ONE],
  )
  assert.equal(page.historyComplete, true)
})

test('finds a Session by a Session id substring', async (context) => {
  const { reader } = await twoHarnessReader(context)

  const page = await search(reader, CLAUDE_ONE.slice(-6))

  assert.deepEqual(
    page.sessions.map((row) => row.id),
    [CLAUDE_ONE],
  )
})

test('answers no matches for a query nothing holds', async (context) => {
  const { reader } = await twoHarnessReader(context)

  const page = await search(reader, 'nothing-matches-this')

  assert.deepEqual(page.sessions, [])
  assert.equal(page.nextCursor, null)
})

test('an archived Session is found under the archived filter and hidden under active', async (context) => {
  const { reader } = await twoHarnessReader(context)
  sessionArchiveSetReplySchema.parse(
    await reader.archiveSet({
      version: 1,
      type: 'session.archive.set',
      requestId: 'archive-set-1',
      sessionIds: [CODEX_ONE],
      archived: true,
    }),
  )

  const active = await search(reader, 'archive pagination', { status: 'active' })
  const archived = await search(reader, 'archive pagination', { status: 'archived' })

  assert.deepEqual(active.sessions, [])
  assert.deepEqual(
    archived.sessions.map((row) => row.id),
    [CODEX_ONE],
  )
  assert.ok(archived.sessions.every((row) => row.archived))
})

test('scopes matches to the named Project, excluding a Session outside it', async (context) => {
  const { reader } = await twoHarnessReader(context)

  const page = await search(reader, 'e', { projectRoot: '/repo/argo' })

  assert.deepEqual(
    page.sessions.map((row) => row.id),
    [CLAUDE_ONE],
  )
})
