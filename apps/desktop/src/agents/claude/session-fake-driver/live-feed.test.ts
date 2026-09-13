import assert from 'node:assert/strict'
import { appendFile, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import type { LiveMessage } from '../drive/live-messages'
import { createClaudeSessionReader } from '../sessions/read-sessions'

const SESSION = 'c3b0f6a2-5d7e-4f7a-9d61-2f1f3c1d8e10'

type Row = { id: string; shape: string; role?: string; text?: string }

// Records in the shapes claude 2.1.270 writes: one record per content block.
const records = {
  prompt: (uuid: string, text: string) => ({
    type: 'user',
    uuid,
    message: { role: 'user', content: text },
  }),
  text: (uuid: string, text: string) => ({
    type: 'assistant',
    uuid,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  }),
  read: (uuid: string) => ({
    type: 'assistant',
    uuid,
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'toolu-read', name: 'Read', input: { file_path: 'a' } }],
    },
  }),
  result: (uuid: string) => ({
    type: 'user',
    uuid,
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu-read', content: 'Mallards.' }],
    },
  }),
}

async function transcript(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-live-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'project'))
  const file = path.join(root, 'project', `${SESSION}.jsonl`)
  await writeFile(file, '')
  let written = 0
  return {
    root,
    // A later mtime than the last write, so the reader's stamp sees every append.
    async append(...lines: Record<string, unknown>[]) {
      const stamped = lines.map((line) => ({ ...line, sessionId: SESSION, timestamp: stamp() }))
      await appendFile(file, stamped.map((line) => `${JSON.stringify(line)}\n`).join(''))
      written += 1
      const ahead = new Date(Date.now() + written * 2000)
      await utimes(file, ahead, ahead)
    },
  }
}

let clock = 0
function stamp() {
  clock += 1
  return new Date(Date.UTC(2026, 8, 13, 15, 0, clock)).toISOString()
}

function feedOf(live: () => LiveMessage[], root: string) {
  const reader = createClaudeSessionReader({ transcripts: root, liveMessages: () => live() })
  return async (revision: string | null = null) => {
    const reply = (await reader.readSessionFeed({
      version: 1,
      type: 'session.feed',
      requestId: 'feed-1',
      sessionId: SESSION,
      revision,
    })) as { type: string; revision: string; rows?: Row[] }
    return reply
  }
}

const said = (rows: Row[] | undefined) =>
  (rows ?? [])
    .filter((row) => row.shape === 'prose')
    .map(({ id, role, text }) => ({ id, role, text }))

test('shows the reply a Claude Turn is drawing, and its growth, before the transcript holds it', async (context) => {
  const { root, append } = await transcript(context)
  await append(records.prompt('prompt-1', 'Write about ducks.'))
  let live: LiveMessage[] = [{ id: 'ducks', text: 'Ducks glide.\n' }]
  const read = feedOf(() => live, root)

  const first = await read()
  assert.deepEqual(said(first.rows), [
    { id: 'prompt-1:0', role: 'user', text: 'Write about ducks.' },
    { id: 'display:ducks', role: 'assistant', text: 'Ducks glide.\n' },
  ])
  assert.equal((await read(first.revision)).type, 'session.feed.unchanged')

  live = [{ id: 'ducks', text: 'Ducks glide.\nThey dabble.\n' }]
  const grown = await read(first.revision)
  assert.equal(grown.type, 'session.feed.read')
  assert.equal(said(grown.rows).at(-1)?.text, 'Ducks glide.\nThey dabble.\n')
})

test('replaces each draft with its transcript row, once and under the same id, across a tool call', async (context) => {
  const { root, append } = await transcript(context)
  await append(records.prompt('prompt-1', 'Write about ducks, read a, then geese.'))
  let live: LiveMessage[] = [{ id: 'ducks', text: 'Ducks glide.\nLet me read a.' }]
  const read = feedOf(() => live, root)
  const before = said((await read()).rows)

  await append(records.text('text-1', 'Ducks glide.\nLet me read a.'), records.read('read-1'))
  await append(records.result('result-1'))
  live = [...live, { id: 'geese', text: 'Geese honk.\n' }]
  const between = await read()

  await append(records.text('text-2', 'Geese honk.\nThey fly south.'))
  live = [live[0] as LiveMessage, { id: 'geese', text: 'Geese honk.\nThey fly south.' }]
  const landed = await read()

  const ducks = { id: 'display:ducks', role: 'assistant', text: 'Ducks glide.\nLet me read a.' }
  const geese = { id: 'display:geese', role: 'assistant', text: 'Geese honk.\n' }
  assert.deepEqual(before.slice(1), [ducks])
  assert.deepEqual(said(between.rows).slice(1), [ducks, geese])
  assert.deepEqual(
    between.rows?.map((row) => row.id),
    ['prompt-1:0', 'display:ducks', 'read-1:0', 'toolu-read', 'result-1:0', 'display:geese'],
  )
  assert.deepEqual(said(landed.rows).slice(1), [
    ducks,
    { ...geese, text: 'Geese honk.\nThey fly south.' },
  ])
})

test('keeps a streamed row’s id after Argo sends the next Turn, and matches from the new prompt', async (context) => {
  const { root, append } = await transcript(context)
  await append(records.prompt('prompt-1', 'Write about ducks.'))
  let live: LiveMessage[] = [{ id: 'ducks', text: 'Ducks glide.' }]
  const read = feedOf(() => live, root)
  await read()
  await append(records.text('text-1', 'Ducks glide.'))
  await read()

  live = [{ id: 'geese', text: 'Geese honk.\n' }]
  await append(records.prompt('prompt-2', 'Now geese.'))
  const next = await read()

  assert.deepEqual(said(next.rows), [
    { id: 'prompt-1:0', role: 'user', text: 'Write about ducks.' },
    { id: 'display:ducks', role: 'assistant', text: 'Ducks glide.' },
    { id: 'prompt-2:0', role: 'user', text: 'Now geese.' },
    { id: 'display:geese', role: 'assistant', text: 'Geese honk.\n' },
  ])
})
