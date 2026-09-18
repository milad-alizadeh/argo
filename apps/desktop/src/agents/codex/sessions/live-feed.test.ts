import assert from 'node:assert/strict'
import { appendFile, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { SessionReader } from '../../../domains/sessions/main/bridge'
import { createSessionReader } from '../../../domains/sessions/main/reader'
import type { LiveMessage } from '../drive/codex-session-driver'
import { codexSessionSource } from './read-sessions'

const SESSION = 'liveThread'

function line(value: unknown) {
  return `${JSON.stringify(value)}\n`
}

async function rollout(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-live-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '13')
  await mkdir(day, { recursive: true })
  const file = path.join(day, `${SESSION}.jsonl`)
  await writeFile(
    file,
    line({
      timestamp: '2026-09-13T14:51:44.000Z',
      type: 'session_meta',
      payload: { id: SESSION },
    }) +
      line({
        timestamp: '2026-09-13T14:51:47.000Z',
        type: 'event_msg',
        payload: { type: 'user_message', message: 'Write about ducks.' },
      }),
  )
  return { root, file }
}

function reading(revision: string | null) {
  return {
    version: 1 as const,
    type: 'session.feed' as const,
    requestId: 'feed-1',
    sessionId: SESSION,
    delegationId: null,
    revision,
  }
}

async function read(reader: SessionReader, revision: string | null) {
  const reply = await reader.readSessionFeed(reading(revision))
  assert.ok(typeof reply === 'object' && reply !== null && 'type' in reply)
  return reply as { type: string; revision: string; rows?: { id: string; text?: string }[] }
}

test('shows the agent message a Turn is writing, and its growth, before the rollout holds it', async (context) => {
  const { root } = await rollout(context)
  let live: LiveMessage[] = [{ id: 'msg-1', text: 'Ducks' }]
  const reader = createSessionReader([codexSessionSource(root, { liveMessages: () => live })])

  const first = await read(reader, null)
  assert.deepEqual(
    first.rows?.map(({ id, text }) => ({ id, text })),
    [
      { id: 'user:2026-09-13T14:51:47.000Z:0', text: 'Write about ducks.' },
      { id: 'msg-1:0', text: 'Ducks' },
    ],
  )
  assert.equal((await read(reader, first.revision)).type, 'session.feed.unchanged')

  live = [{ id: 'msg-1', text: 'Ducks glide.' }]
  const grown = await read(reader, first.revision)
  assert.equal(grown.type, 'session.feed.read')
  assert.equal(grown.rows?.at(-1)?.text, 'Ducks glide.')
})

test('draws a finished message once, from the rollout, under the id it streamed with', async (context) => {
  const { root, file } = await rollout(context)
  const reader = createSessionReader([
    codexSessionSource(root, {
      liveMessages: () => [{ id: 'msg-1', text: 'Ducks glide.' }],
    }),
  ])
  const streaming = await read(reader, null)

  await appendFile(
    file,
    line({
      timestamp: '2026-09-13T14:51:49.000Z',
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        thread_id: SESSION,
        turn_id: 'turn-1',
        item: {
          type: 'AgentMessage',
          id: 'msg-1',
          content: [{ type: 'Text', text: 'Ducks glide.' }],
        },
      },
    }) +
      line({
        timestamp: '2026-09-13T14:51:49.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          id: 'msg-1',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Ducks glide.' }],
        },
      }),
  )
  const ahead = new Date(Date.now() + 2000)
  await utimes(file, ahead, ahead)

  const landed = await read(reader, streaming.revision)
  assert.deepEqual(
    landed.rows?.map(({ id }) => id),
    ['user:2026-09-13T14:51:47.000Z:0', 'msg-1:0'],
  )
})
