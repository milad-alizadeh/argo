import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectFeed } from '@/core/sessions/feed'
import { projectFeedIncrementally } from '@/core/sessions/feed-incremental'
import { parseTranscriptLine } from './records'

function commandMessage(uuid: string, callId: string) {
  return {
    kind: 'message' as const,
    uuid,
    parentUuid: null,
    originSessionId: null,
    role: 'assistant' as const,
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp: null,
    entry: 'interactive' as const,
    stopReason: null,
    model: null,
    effort: null,
    mode: null,
    blocks: [{ shape: 'tool' as const, callId }],
    toolCalls: [{ id: callId, name: 'Bash', input: { command: 'true' } }],
    toolResults: [],
    answeredCalls: [],
    usage: null,
  }
}

test('keeps commands from distinct transcript events separate across a hidden delivery', () => {
  const delivery = parseTranscriptLine(
    JSON.stringify({
      type: 'user',
      uuid: 'delivery-2',
      userType: 'external',
      sourceToolAssistantUUID: 'tool-1',
      message: { role: 'user', content: '<transcript_delta>internal update</transcript_delta>' },
    }),
  )
  if (delivery === null) assert.fail('expected transcript delivery to parse')
  const chain = {
    id: 'session',
    retiredIds: [],
    originUnread: false,
    files: [
      {
        path: '/tmp/session.jsonl',
        sessionId: 'session',
        resumedFrom: null,
        originSessionId: null,
        openedAt: '',
        openingPrompt: null,
        records: [
          commandMessage('command-1', 'call-1'),
          delivery,
          commandMessage('command-2', 'call-2'),
        ],
        unreadableLines: 0,
      },
    ],
  }
  const projections = [projectFeed(chain), projectFeedIncrementally(chain, undefined).rows]
  for (const rows of projections) {
    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.shape, 'tool-group')
    assert.equal(rows[0]?.shape === 'tool-group' ? rows[0].calls.length : 0, 1)
    assert.equal(rows[1]?.shape, 'tool-group')
    assert.equal(rows[1]?.shape === 'tool-group' ? rows[1].calls.length : 0, 1)
  }
})
