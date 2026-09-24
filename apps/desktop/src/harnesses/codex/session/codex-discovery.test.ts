import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readCodexSessions } from './codex-discovery'

test('parses valid Codex discovery records and counts invalid ones', async () => {
  const result = await readCodexSessions(
    async (_method, _params, parse) =>
      parse({
        data: [
          {
            id: 'thread-1',
            name: 'Review the change',
            updatedAt: 42,
            cwd: '/repo',
          },
          {
            id: '',
          },
        ],
        nextCursor: 'next',
      }),
    null,
    50,
  )
  assert.deepEqual(result, {
    sessions: [
      {
        harness: 'codex',
        nativeId: 'thread-1',
        vendorTitle: 'Review the change',
        firstPrompt: null,
        updatedAt: 42_000,
        workingDirectory: '/repo',
      },
    ],
    nextCursor: 'next',
    invalidRecordCount: 1,
  })
})
