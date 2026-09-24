import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CodexRequest } from '../app-server/codex-app-server-machine'
import { parseCodexHistory, readCodexHistory } from './codex-history'

test('maps recorded Codex thread items without treating active status as remote ownership', () => {
  assert.deepEqual(
    parseCodexHistory(
      {
        thread: {
          id: 'thread-1',
          status: { type: 'active', activeFlags: [] },
          turns: [
            {
              id: 'turn-1',
              items: [
                {
                  id: 'user-1',
                  type: 'userMessage',
                  content: [{ type: 'text', text: 'Review this.' }],
                },
                { id: 'assistant-1', type: 'agentMessage', text: 'I will review it.' },
              ],
            },
          ],
        },
      },
      'thread-1',
    ),
    {
      availability: {
        state: 'unknown',
        reason: 'Codex is checking where this Session is active.',
      },
      active: true,
      entries: [
        { sourceId: 'user-1', role: 'user', text: 'Review this.' },
        { sourceId: 'assistant-1', role: 'assistant', text: 'I will review it.' },
      ],
    },
  )
})

const activeThread = {
  thread: {
    id: 'thread-1',
    status: { type: 'active', activeFlags: [] },
    turns: [],
  },
}

test('a complete loaded-thread list can prove a Codex Session is active elsewhere', async () => {
  const cursors: Array<string | null> = []
  const request: CodexRequest = async (method, params, parse) => {
    if (method === 'thread/read') return parse(activeThread)
    if (method === 'thread/loaded/list') {
      const cursor = 'cursor' in params ? (params.cursor ?? null) : null
      cursors.push(cursor)
      return parse(
        cursor === null
          ? { data: ['other-thread'], nextCursor: 'next' }
          : { data: ['another-thread'], nextCursor: null },
      )
    }
    throw new Error(`Unexpected method ${method}`)
  }
  const history = await readCodexHistory(request, 'thread-1')
  assert.deepEqual(cursors, [null, 'next'])
  assert.equal(history.availability.state, 'unavailable')
})

test('a failed loaded-thread page leaves Codex availability unknown', async () => {
  const request: CodexRequest = async (method, _params, parse) => {
    if (method === 'thread/read') return parse(activeThread)
    throw new Error('loaded list failed')
  }
  const history = await readCodexHistory(request, 'thread-1')
  assert.equal(history.availability.state, 'unknown')
  assert.deepEqual(history.entries, [])
})

test('keeps a partial Codex history unknown', () => {
  assert.throws(
    () => parseCodexHistory({ thread: { id: 'thread-1', status: { type: 'idle' } } }, 'thread-1'),
    /turns/,
  )
})
