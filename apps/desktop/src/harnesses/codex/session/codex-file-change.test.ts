import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectLiveFeedRows } from '@/domains/sessions/api/feed/live-feed-rows'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import fileChangeTurn from '../../../../mocks/cli/codex/fixtures/live-file-change-codex-0.157.0.json' with {
  type: 'json',
}
import { testChannel } from '../../../../mocks/cli/codex/mock-codex-channel'
import type { CodexRequest, WireMessage } from '../app-server/codex-app-server-client'
import type { ThreadItem } from '../app-server/protocol-generated/v2/thread-item'
import { codexContentFromItems } from './codex-session-history'

async function replayFileChangeTurn() {
  const started = fileChangeTurn.messages.find((message) => message.method === 'turn/started')
  const threadId = started?.params.threadId
  const turnId = started?.params.turn?.id
  assert.ok(threadId)
  assert.ok(turnId)
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) => {
    if (method === 'thread/start') return parse({ thread: { id: threadId } })
    if (method === 'turn/start') return parse({ turn: { id: turnId } })
    throw new Error(`Unexpected request: ${method}`)
  }) as CodexRequest
  const { channel, events, notify } = testChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  for (const message of fileChangeTurn.messages) notify(message as WireMessage)
  channel.close()
  return events.flatMap((event, index): SessionLiveEvent[] =>
    event.type === 'feed'
      ? [
          {
            ...event.body,
            sessionId: '00000000-0000-4000-8000-000000000001',
            sequence: index + 1,
          } as SessionLiveEvent,
        ]
      : [],
  )
}

test('a recorded Codex patch shows its files while it runs', async () => {
  const live = await replayFileChangeTurn()
  const rows = projectLiveFeedRows(
    [],
    live.filter(
      (event) =>
        event.type !== 'content' ||
        event.content.kind !== 'fileChange' ||
        event.content.status === 'running',
    ),
  )
  assert.deepEqual(
    rows.flatMap((row) => (row.shape === 'tool' ? [[row.label, row.status, row.lineCounts]] : [])),
    [
      ['Edited app.txt', 'running', { added: 1, removed: 1 }],
      ['Created notes.md', 'running', { added: 1, removed: 0 }],
    ],
  )
})

test('a history refresh after a recorded Codex patch keeps each file once', async () => {
  const live = await replayFileChangeTurn()
  const history = codexContentFromItems(
    fileChangeTurn.threadRead.thread.turns.flatMap((turn) => turn.items as ThreadItem[]),
  )
  const rows = projectLiveFeedRows(history, live)
  assert.deepEqual(
    rows.flatMap((row) => {
      if (row.shape === 'tool') return [`${row.label} ${row.status}`]
      return row.shape === 'prose' ? [row.role] : []
    }),
    ['user', 'Edited app.txt succeeded', 'Created notes.md succeeded', 'assistant'],
  )
})
