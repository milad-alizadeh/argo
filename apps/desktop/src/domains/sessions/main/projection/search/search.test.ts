// Searching title and Session id across every harness, through the shared reader (#2375). No
// Session index is open here, so every case exercises the window-growing fallback
// (`archive-window.ts`); `search-index.vitest.ts` proves the index-backed path instead.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { sessionArchiveSetReplySchema } from '@/domains/sessions/contract/ipc/contract'
import { rosterRow } from '@/domains/sessions/contract/observation/roster-row-test-fixture'
import { createInMemorySessionTicketLinkStore } from '@/domains/tickets/main'
import { claudeSessionSource } from '@/harnesses/claude/sessions/discovery/read-sessions'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'
import { createSessionArchiveStore, sessionArchivePath } from '../../archive/store/archive-store'
import { indexedAdapters, sessionIdAt } from '../../indexing/session-index/roster-fixtures'
import { createSessionReader } from '../../observation/reader/reader'
import type { SessionSource } from '../../observation/reader/session-source'

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

test('finds a visible Session from an earlier vendor page after search grows the window', async () => {
  const matching = rosterRow({
    id: 'duplicate-investigation',
    harness: 'claude',
    title: { text: 'Duplicate ticket investigation', source: 'custom' },
  })
  const later = rosterRow({ id: 'later-page', harness: 'claude' })
  const source: SessionSource = {
    harness: 'claude',
    discoverSessions: async (request) => ({
      rows: request?.cursor === null || request?.cursor === undefined ? [matching] : [later],
      filesFound: 0,
      filesRead: 0,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: request?.cursor ? null : 'next',
      historyComplete: request?.cursor !== null,
    }),
    readSessionFiles: async () => null,
    readShellOutput: async () => ({ state: 'absent' }),
  }
  const reader = createSessionReader([source])
  const roster = await reader.listSessions({
    version: 1,
    type: 'session.list',
    requestId: 'roster-before-search',
    projectRoot: null,
    cursor: null,
  })
  assert.equal(roster.type, 'session.listed')
  if (roster.type === 'session.listed') {
    assert.deepEqual(
      roster.sessions.map((row) => row.id),
      [matching.id],
    )
  }

  const found = await search(reader, 'Duplicate')
  assert.deepEqual(
    found.sessions.map((row) => row.id),
    [matching.id],
  )
})

test('searches vendor history without paging the roster', async () => {
  const matching = rosterRow({
    id: 'direct-search-match',
    harness: 'claude',
    title: { text: 'Session not showing in dev server', source: 'custom' },
  })
  const source: SessionSource = {
    harness: 'claude',
    discoverSessions: async () => {
      throw new Error('Search must not grow the roster')
    },
    searchSessions: async () => [matching],
    historyComplete: async () => true,
    readSessionFiles: async () => null,
    readShellOutput: async () => ({ state: 'absent' }),
  }

  const found = await search(createSessionReader([source]), 'Session not showing')
  assert.deepEqual(
    found.sessions.map((row) => row.id),
    [matching.id],
  )
  assert.equal(found.historyComplete, true)
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
