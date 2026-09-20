import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import {
  CREATED_THREAD,
  codexHome,
  DELEGATED_REQUEST,
  rosterTitles,
  THREADS_SCHEMA,
  writeStateStore,
} from '@/harnesses/codex/sessions/thread-title-fixtures'

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
