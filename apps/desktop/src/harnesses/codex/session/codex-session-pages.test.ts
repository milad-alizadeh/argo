import assert from 'node:assert/strict'
import { test } from 'node:test'
import recorded from '../../../../mocks/cli/codex/fixtures/turn-page-codex-0.157.0.json' with {
  type: 'json',
}
import type { CodexRequest } from '../app-server/codex-app-server-client'
import { readCodexSessionPage } from './codex-session-pages'

test('Codex reads the recorded 0.157.0 Turn page response', async () => {
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) => {
    assert.equal(method, 'thread/turns/list')
    return parse(recorded.response)
  }) as CodexRequest
  const page = await readCodexSessionPage(request, 'thread-1', null)
  assert.deepEqual(
    page?.content.map((item) => (item.kind === 'message' ? item.text : null)),
    ['Reply OK.'],
  )
})

function turn(id: string, count: number) {
  return {
    id,
    items: Array.from({ length: count }, (_, index) => ({
      id: `${id}-item-${index}`,
      type: 'agentMessage',
      text: `${id} reply ${index}`,
    })),
  }
}

test('Codex reads newest-first Turn pages and resumes within a large Turn', async () => {
  const calls: unknown[] = []
  const request = (async (method: string, params: unknown, parse: (value: unknown) => unknown) => {
    calls.push({ method, params })
    const older = (params as { cursor: string | null }).cursor === 'older-turn'
    return parse({
      data: [older ? turn('older', 1) : turn('newest', 55)],
      nextCursor: older ? null : 'older-turn',
      backwardsCursor: null,
    })
  }) as CodexRequest
  const newest = await readCodexSessionPage(request, 'thread-1', null)
  assert.ok(newest)
  assert.equal(newest.content.length, 50)
  assert.equal(newest.content[0]?.id, 'newest-item-5')
  assert.equal(newest.content.at(-1)?.id, 'newest-item-54')
  assert.ok(newest.olderCursor)
  assert.deepEqual(calls, [
    {
      method: 'thread/turns/list',
      params: {
        threadId: 'thread-1',
        cursor: null,
        limit: 1,
        sortDirection: 'desc',
        itemsView: 'full',
      },
    },
  ])
  const older = await readCodexSessionPage(request, 'thread-1', newest.olderCursor)
  assert.ok(older)
  assert.equal(older.content.at(-1)?.id, 'newest-item-4')
})

test('Codex reports an unavailable Turn page method for thread/read fallback', async () => {
  const request = (async () => {
    throw new Error('thread/turns/list requires experimentalApi capability')
  }) as CodexRequest
  assert.equal(await readCodexSessionPage(request, 'thread-1', null), null)
  const fallbackCursor = Buffer.from(
    JSON.stringify({
      version: 1,
      sessionId: 'session-1',
      chainId: 'session-1',
      firstIndex: 0,
      firstItemId: 'item-1',
    }),
  ).toString('base64url')
  assert.equal(await readCodexSessionPage(request, 'thread-1', fallbackCursor), null)
})
