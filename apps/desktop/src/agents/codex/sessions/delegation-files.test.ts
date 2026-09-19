import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { sessionFeedReplySchema } from '../../../domains/sessions/contract/contract'
import { createSessionReader } from '../../../domains/sessions/main/reader'
import { codexSessionSource } from './read-sessions'

test('reads a spawned agent transcript from its parent delegation', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-delegation-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '14')
  await mkdir(day, { recursive: true })
  const parentId = '01a09d44-306e-7b00-b7c7-0391bb2ae34f'
  const childId = '01a09d44-306e-7b00-b7c7-0391bb2ae34e'
  const write = (id: string, records: object[]) =>
    writeFile(
      path.join(day, `${id}.jsonl`),
      records.map((record) => JSON.stringify(record)).join('\n'),
    )
  await write(parentId, [
    {
      timestamp: '2026-09-14T00:14:46.946Z',
      type: 'response_item',
      payload: {
        type: 'function_call',
        id: 'call-record',
        call_id: 'call-agent',
        name: 'spawn_agent',
        arguments: JSON.stringify({ task_name: 'standards_review' }),
      },
    },
  ])
  await write(childId, [
    {
      type: 'session_meta',
      payload: {
        id: childId,
        thread_source: 'subagent',
        source: {
          subagent: {
            thread_spawn: { parent_thread_id: parentId, agent_path: '/root/standards_review' },
          },
        },
      },
    },
    {
      timestamp: '2026-09-14T00:14:50.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        id: 'message-1',
        content: [{ type: 'output_text', text: 'The review is complete.' }],
      },
    },
  ])

  const reply = sessionFeedReplySchema.parse(
    await createSessionReader([codexSessionSource(root)]).readSessionFeed({
      version: 1,
      type: 'session.feed',
      requestId: 'delegation-feed',
      sessionId: parentId,
      subagentId: 'call-agent',
      revision: null,
    }),
  )
  assert.equal(reply.type, 'session.feed.read')
  if (reply.type === 'session.feed.read')
    assert.deepEqual(reply.rows, [
      { shape: 'prose', id: 'message-1:0', role: 'assistant', text: 'The review is complete.' },
    ])
})
