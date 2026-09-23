import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EXPERIMENTAL_TURN_PAGE_METHOD,
  type HistoryTransport,
  listStoredThreads,
  readStoredThread,
  STORED_THREAD_READ_METHOD,
} from './vendor-history'

const THREAD = {
  id: 'thread-1',
  cwd: '/work/checkout',
  name: 'Old notes',
  branch: 'main',
  updatedAt: 1_700_000_000,
  status: { type: 'idle' },
}

function transport(handlers: Record<string, (params: Record<string, unknown>) => unknown>): {
  calls: { method: string; params: Record<string, unknown> }[]
  client: HistoryTransport
} {
  const calls: { method: string; params: Record<string, unknown> }[] = []
  return {
    calls,
    client: {
      request: (method, params) => {
        calls.push({ method, params })
        const handler = handlers[method]
        if (handler === undefined) throw new Error(`unexpected ${method}`)
        return Promise.resolve(handler(params))
      },
    },
  }
}

test('pins experimental turn pagination and falls back to thread/read', async () => {
  assert.equal(EXPERIMENTAL_TURN_PAGE_METHOD, 'thread/turns/list')
  assert.equal(STORED_THREAD_READ_METHOD, 'thread/read')
  const vendor = transport({
    [EXPERIMENTAL_TURN_PAGE_METHOD]: () => {
      throw new Error('thread/turns/list requires experimentalApi capability')
    },
    [STORED_THREAD_READ_METHOD]: () => ({
      thread: {
        ...THREAD,
        turns: [
          {
            id: 'turn-1',
            status: 'completed',
            startedAt: 1_700_000_000,
            items: [
              {
                id: 'message-1',
                type: 'userMessage',
                content: [{ type: 'text', text: 'Remember this' }],
              },
            ],
          },
        ],
      },
    }),
  })

  const thread = await readStoredThread(vendor.client, 'thread-1')
  assert.equal(thread.turns[0]?.items[0]?.text, 'Remember this')
  assert.deepEqual(
    vendor.calls.map((call) => call.method),
    [EXPERIMENTAL_TURN_PAGE_METHOD, STORED_THREAD_READ_METHOD],
  )
})

test('uses experimental pages when the vendor accepts them', async () => {
  const vendor = transport({
    [EXPERIMENTAL_TURN_PAGE_METHOD]: (params) =>
      params.cursor === undefined
        ? {
            data: [
              {
                id: 'turn-1',
                status: 'completed',
                items: [{ id: 'message-1', type: 'userMessage', text: 'Page one' }],
              },
            ],
            nextCursor: 'page-2',
          }
        : {
            data: [
              {
                id: 'turn-2',
                status: 'completed',
                items: [{ id: 'message-2', type: 'agentMessage', text: 'Page two' }],
              },
            ],
            nextCursor: null,
          },
    [STORED_THREAD_READ_METHOD]: () => ({ thread: THREAD }),
  })

  const thread = await readStoredThread(vendor.client, 'thread-1')
  assert.deepEqual(
    thread.turns.flatMap((turn) => turn.items.map((item) => item.text)),
    ['Page one', 'Page two'],
  )
})

test('reports history unavailable when neither vendor read is sufficient', async () => {
  const vendor = transport({
    [EXPERIMENTAL_TURN_PAGE_METHOD]: () => {
      throw new Error('thread/turns/list requires experimentalApi capability')
    },
    [STORED_THREAD_READ_METHOD]: () => {
      throw new Error('thread/read failed')
    },
  })

  await assert.rejects(readStoredThread(vendor.client, 'thread-1'), /thread\/read failed/)
  assert.equal(
    vendor.calls.some((call) => call.method.includes('rollout') || call.method.includes('file')),
    false,
  )
})

test('lists stored threads through app-server pages', async () => {
  const vendor = transport({
    'thread/list': (params) =>
      params.cursor === undefined
        ? { data: [THREAD], nextCursor: 'next' }
        : { data: [{ ...THREAD, id: 'thread-2', name: 'Later' }], nextCursor: null },
  })

  const threads = await listStoredThreads(vendor.client)
  assert.deepEqual(
    threads.map((thread) => thread.id),
    ['thread-1', 'thread-2'],
  )
  assert.deepEqual(vendor.calls[0]?.params, {
    limit: 50,
    sourceKinds: ['appServer', 'cli', 'vscode'],
    useStateDbOnly: true,
  })
})

test('asks app-server to repair an empty state database without reading rollouts in Argo', async () => {
  const vendor = transport({
    'thread/list': (params) =>
      params.useStateDbOnly === true
        ? { data: [], nextCursor: null }
        : { data: [THREAD], nextCursor: null },
  })

  const threads = await listStoredThreads(vendor.client)

  assert.deepEqual(
    threads.map((thread) => thread.id),
    ['thread-1'],
  )
  assert.deepEqual(
    vendor.calls.map((call) => call.params.useStateDbOnly),
    [true, undefined],
  )
})
