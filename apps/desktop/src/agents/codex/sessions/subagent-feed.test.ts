import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createSessionReader } from '@/core/sessions/reader'
import { codexSessionSource } from './read-sessions'

const sessionId = '01a0abe3-4484-7271-9336-9c4dc2be9f7b'
const delegationId = '01a0abe3-96a2-7272-8db3-d24dbf36d454'

function completedReview() {
  return {
    type: 'response_item',
    timestamp: '2026-09-16T21:23:35.000Z',
    payload: {
      type: 'message',
      id: 'review-complete',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'The review is complete.' }],
    },
  }
}

async function writeDelegation(root: string, records: object[]) {
  const day = path.join(root, '2026', '09', '16')
  await mkdir(day, { recursive: true })
  await writeFile(
    path.join(day, `rollout-2026-09-16T21-23-13-${sessionId}.jsonl`),
    `${JSON.stringify({
      type: 'event_msg',
      timestamp: '2026-09-16T21:23:13.000Z',
      payload: { type: 'user_message', message: 'Review the implementation.' },
    })}\n`,
  )
  await writeFile(
    path.join(day, `rollout-2026-09-16T21-23-34-${delegationId}.jsonl`),
    records.map((record) => JSON.stringify(record)).join('\n'),
  )
}

async function delegationRows(root: string) {
  const reply = await createSessionReader([codexSessionSource(root)]).readSessionFeed({
    version: 1,
    type: 'session.feed',
    requestId: 'feed-1',
    sessionId,
    delegationId,
    revision: null,
  })
  assert.ok(reply.type === 'session.feed.read')
  return reply.rows
}

test('opens a Codex subagent transcript from its Agent card', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-delegation-feed-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  await writeDelegation(root, [
    {
      type: 'session_meta',
      timestamp: '2026-09-16T21:23:34.000Z',
      payload: { id: delegationId, thread_source: 'subagent' },
    },
    completedReview(),
  ])

  assert.deepEqual(await delegationRows(root), [
    { id: 'review-complete:0', shape: 'prose', role: 'assistant', text: 'The review is complete.' },
  ])
})

test('does not draw a repeated Codex subagent message twice', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-delegation-duplicate-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const message = completedReview()
  await writeDelegation(root, [message, message])

  assert.deepEqual(
    (await delegationRows(root)).map((row) => row.id),
    ['review-complete:0'],
  )
})
