import { expect, test } from 'vitest'
import { mockTurnsPage } from '@/mocks/cli/codex/mock-codex-turn-pages'
import { recordedThread } from '@/mocks/cli/codex/recorded-codex-threads'
import { RECORDED_PROMPTS } from '@/mocks/cli/recorded-prompts'
import type { CodexRequest } from '../app-server'
import {
  CODEX_TAIL_TURNS,
  readCodexSessionHistory,
  readCodexSessionTail,
} from './codex-session-history'

// The recorded Turn again and again, each copy with ids of its own, so a thread has many pages.
function recordedTurns(count: number, from = 0) {
  const [turn] = recordedThread(RECORDED_PROMPTS.codexReply).turns
  if (turn === undefined) throw new Error('The recorded Codex thread has no Turn.')
  return Array.from({ length: count }, (_, index) => ({
    ...turn,
    id: `turn-${from + index}`,
    items: turn.items.map((item) => ({ ...item, id: `${item.id}-${from + index}` })),
  }))
}

// A mock app-server over a thread that can grow, logging every Turn page asked for.
function growingThread(count: number) {
  const turns = recordedTurns(count)
  const requests: Record<string, unknown>[] = []
  const request = (async (method: string, params: Record<string, unknown>, parse) => {
    if (method !== 'thread/turns/list') throw new Error(`Unexpected request: ${method}`)
    requests.push(params)
    return parse(mockTurnsPage(turns, params))
  }) as CodexRequest
  return { turns, requests, request }
}

const newestPage = (cursor: string | null) => ({
  threadId: 'thread-tail',
  itemsView: 'full',
  sortDirection: 'desc',
  limit: CODEX_TAIL_TURNS,
  cursor,
})

test('opening a Codex Session asks the app-server for its newest Turns only', async () => {
  const thread = growingThread(5 * CODEX_TAIL_TURNS)
  const whole = await readCodexSessionHistory(thread.request, 'thread-tail')
  thread.requests.length = 0

  const tail = await readCodexSessionTail(thread.request, 'thread-tail', 0)

  expect(thread.requests).toEqual([newestPage(null)])
  expect(tail.complete).toBe(false)
  expect(tail.content).toEqual(whole.slice(-tail.content.length))
  expect(tail.content.length).toBe(whole.length / 5)
})

test('a wider read asks only for the page before the Turns already read', async () => {
  const thread = growingThread(3 * CODEX_TAIL_TURNS)
  const whole = await readCodexSessionHistory(thread.request, 'thread-wide')
  await readCodexSessionTail(thread.request, 'thread-wide', 0)
  thread.requests.length = 0

  const wider = await readCodexSessionTail(thread.request, 'thread-wide', 2)

  expect(thread.requests.map(({ cursor }) => cursor)).toEqual([null, '10', '20'])
  expect(wider).toEqual({ content: whole, complete: true })
})

test('a reopen asks again only for the newest page, and joins a new Turn to the ones it holds', async () => {
  const thread = growingThread(2 * CODEX_TAIL_TURNS)
  await readCodexSessionTail(thread.request, 'thread-grow', 1)
  thread.turns.push(...recordedTurns(3, 1_000))
  thread.requests.length = 0

  const grown = await readCodexSessionTail(thread.request, 'thread-grow', 1)

  expect(thread.requests).toEqual([{ ...newestPage(null), threadId: 'thread-grow' }])
  expect(grown).toEqual({
    content: await readCodexSessionHistory(thread.request, 'thread-grow'),
    complete: true,
  })
})
