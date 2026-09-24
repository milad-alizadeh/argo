import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseClaudeSessions } from './claude-discovery'

test('parses valid Claude discovery records and counts invalid ones', () => {
  const result = parseClaudeSessions([
    {
      sessionId: 'a4b891f9-8b17-4c01-b9fb-2bfed7f57461',
      summary: 'Review the change',
      firstPrompt: 'Review the change',
      lastModified: 42,
      cwd: '/repo',
    },
    {
      sessionId: 'not-a-session-id',
    },
  ])
  assert.deepEqual(result, {
    sessions: [
      {
        harness: 'claude',
        nativeId: 'a4b891f9-8b17-4c01-b9fb-2bfed7f57461',
        vendorTitle: 'Review the change',
        firstPrompt: 'Review the change',
        updatedAt: 42,
        workingDirectory: '/repo',
      },
    ],
    recordCount: 2,
    invalidRecordCount: 1,
  })
})
