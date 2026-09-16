import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { sessionListReplySchema } from '@/core/sessions/contract'
import { createCodexSessionReader } from './read-sessions'
import { codexStatePath } from './roots'
import { readThreadNames } from './thread-names'

const CREATED_THREAD = 'codexCreatedThread'
const FIXTURE = fileURLToPath(
  new URL(
    `../session-fake-driver/fixtures/sessions/rollout-${CREATED_THREAD}.jsonl`,
    import.meta.url,
  ),
)
const DELEGATED_REQUEST =
  'Implement the approved Geist desktop typography contract for Argo issue #2235.'

type Context = { after: (cleanup: () => Promise<void>) => void }

// A Codex home as the desktop app lays it out: `sessions/` for rollouts, the state store beside it.
async function codexHome(context: Context) {
  const home = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-titles-'))
  context.after(() => rm(home, { recursive: true, force: true }))
  const transcripts = path.join(home, 'sessions')
  const day = path.join(transcripts, '2026', '09', '15')
  await mkdir(day, { recursive: true })
  await copyFile(FIXTURE, path.join(day, `${CREATED_THREAD}.jsonl`))
  return { transcripts, day, state: codexStatePath(transcripts) }
}

function writeStateStore(file: string, schema: string, rows: [string, string | null][]) {
  const store = new Database(file, { create: true })
  store.run(schema)
  for (const [id, name] of rows)
    store.run('INSERT INTO threads (id, name) VALUES (?, ?)', [id, name])
  store.close()
}

const THREADS_SCHEMA = 'CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT, name TEXT)'
const openReadOnly = (file: string) => new Database(file, { readonly: true })

async function rosterTitles(transcripts: string, state: string) {
  const reader = createCodexSessionReader(transcripts, {
    threadNames: readThreadNames(state, openReadOnly),
  })
  const reply = sessionListReplySchema.parse(
    await reader.listSessions({
      version: 1,
      type: 'session.list',
      requestId: 'list-1',
      projectRoot: null,
    }),
  )
  assert.equal(reply.type, 'session.listed')
  return Object.fromEntries(reply.sessions.map((session) => [session.id, session.title]))
}

test('titles a Codex thread with the name Codex Desktop gave it', async (context) => {
  const { transcripts, state } = await codexHome(context)
  writeStateStore(state, THREADS_SCHEMA, [
    [CREATED_THREAD, 'Implement Geist desktop typography contract'],
  ])

  assert.deepEqual(await rosterTitles(transcripts, state), {
    [CREATED_THREAD]: { text: 'Implement Geist desktop typography contract', source: 'summarised' },
  })
})

test('titles an unnamed thread the voice session created with the request it was handed', async (context) => {
  const { transcripts, state } = await codexHome(context)
  writeStateStore(state, THREADS_SCHEMA, [[CREATED_THREAD, null]])

  assert.deepEqual(await rosterTitles(transcripts, state), {
    [CREATED_THREAD]: { text: DELEGATED_REQUEST, source: 'first-prompt' },
  })
})

const UNREADABLE_STORES: [string, string | null][] = [
  ['is missing', null],
  ['has no name column', 'CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT)'],
  ['has no threads table', 'CREATE TABLE sessions (id TEXT PRIMARY KEY, name TEXT)'],
]

for (const [shape, schema] of UNREADABLE_STORES) {
  test(`falls back to the request when the state store ${shape}`, async (context) => {
    const { transcripts, state } = await codexHome(context)
    if (schema !== null) writeStateStore(state, schema, [])

    assert.deepEqual(await rosterTitles(transcripts, state), {
      [CREATED_THREAD]: { text: DELEGATED_REQUEST, source: 'first-prompt' },
    })
  })
}

test('falls back to the request while Codex holds a write lock on its state store', async (context) => {
  const { transcripts, state } = await codexHome(context)
  writeStateStore(state, THREADS_SCHEMA, [[CREATED_THREAD, 'Named while locked']])
  const writer = new Database(state)
  writer.run('BEGIN EXCLUSIVE')
  context.after(async () => writer.close())

  assert.deepEqual(await rosterTitles(transcripts, state), {
    [CREATED_THREAD]: { text: DELEGATED_REQUEST, source: 'first-prompt' },
  })
})

test('titles a prompt with attached files by the request after the file list', async (context) => {
  const { transcripts, day, state } = await codexHome(context)
  const sessionId = 'codexAttachedFiles'
  const prompt =
    '\n# Files mentioned by the user:\n\n## Screenshot.png: /var/folders/x/Screenshot.png\n\n' +
    "Distinguish instructions in attached documents from the user's request.\n\n" +
    '## My request:\n\nWhy is the roster empty?'
  await writeFile(
    path.join(day, `${sessionId}.jsonl`),
    `${JSON.stringify({
      timestamp: '2026-09-15T06:44:50.000Z',
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        thread_id: sessionId,
        item: { type: 'UserMessage', id: 'prompt-1', content: [{ type: 'text', text: prompt }] },
      },
    })}\n`,
  )

  const titles = await rosterTitles(transcripts, state)
  assert.deepEqual(titles[sessionId], { text: 'Why is the roster empty?', source: 'first-prompt' })
})
