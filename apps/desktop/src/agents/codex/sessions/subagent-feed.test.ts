import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createSessionReader } from '@/core/sessions/reader'
import { projectRosterRow } from '@/core/sessions/roster'
import { codexSessionSource } from './read-sessions'

test('opens a Codex subagent transcript from its Agent card', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-delegation-feed-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '16')
  await mkdir(day, { recursive: true })
  const sessionId = '01a0abe3-4484-7271-9336-9c4dc2be9f7b'
  const delegationId = '01a0abe3-96a2-7272-8db3-d24dbf36d454'
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
    [
      {
        type: 'session_meta',
        timestamp: '2026-09-16T21:23:34.000Z',
        payload: { id: delegationId, thread_source: 'subagent' },
      },
      {
        type: 'response_item',
        timestamp: '2026-09-16T21:23:35.000Z',
        payload: {
          type: 'message',
          id: 'review-complete',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'The review is complete.' }],
        },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n'),
  )

  const reply = await createSessionReader([codexSessionSource(root)]).readSessionFeed({
    version: 1,
    type: 'session.feed',
    requestId: 'feed-1',
    sessionId,
    delegationId,
    revision: null,
  })
  assert.ok(reply.type === 'session.feed.read')
  assert.deepEqual(reply.rows, [
    { id: 'review-complete:0', shape: 'prose', role: 'assistant', text: 'The review is complete.' },
  ])
})

async function writeBackgroundAgent(root: string, sessionId: string, delegationId: string) {
  const day = path.join(root, '2026', '09', '16')
  await mkdir(day, { recursive: true })
  await writeFile(
    path.join(day, `rollout-2026-09-16T21-23-13-${sessionId}.jsonl`),
    [
      {
        type: 'event_msg',
        timestamp: '2026-09-16T21:23:34.000Z',
        payload: {
          type: 'item_completed',
          item: {
            type: 'SubAgentActivity',
            id: 'activity-started',
            kind: 'started',
            agent_thread_id: delegationId,
            agent_path: '/root/review_feed',
          },
        },
      },
      {
        type: 'event_msg',
        timestamp: '2026-09-16T21:24:46.000Z',
        payload: {
          type: 'item_completed',
          item: {
            type: 'SubAgentActivity',
            id: 'activity-completed',
            kind: 'completed',
            agent_thread_id: delegationId,
            agent_path: '/root/review_feed',
          },
        },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n'),
  )
  await writeFile(
    path.join(day, `rollout-2026-09-16T21-23-34-${delegationId}.jsonl`),
    `${JSON.stringify({
      type: 'token_usage_record',
      payload: {
        thread_token_usage: { input_tokens: 2000, cached_input_tokens: 500, output_tokens: 700 },
      },
    })}\n`,
  )
}

test('reads a Codex background agent duration and token usage', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-delegation-usage-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const sessionId = '01a0abe3-4484-7271-9336-9c4dc2be9f7b'
  const delegationId = '01a0abe3-96a2-7272-8db3-d24dbf36d454'
  await writeBackgroundAgent(root, sessionId, delegationId)

  const reader = createSessionReader([codexSessionSource(root)])
  const usage = await reader.readDelegationUsage({
    version: 1,
    type: 'session.delegation.usage',
    requestId: 'usage-1',
    sessionId,
  })
  assert.deepEqual(usage.type === 'session.delegation.usage.read' ? usage.usage : null, [
    { id: delegationId, tokens: 2200 },
  ])

  const chain = await codexSessionSource(root).readSessionFiles(sessionId)
  assert.ok(chain !== null)
  assert.deepEqual(projectRosterRow(chain, 'codex').delegations, [
    {
      id: delegationId,
      label: 'Review feed',
      landed: true,
      startedAt: '2026-09-16T21:23:34.000Z',
      endedAt: '2026-09-16T21:24:46.000Z',
    },
  ])
})
