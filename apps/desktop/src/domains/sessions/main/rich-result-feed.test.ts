import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionChain } from '@/domains/sessions/contract/chains'
import { checkedDataImageUrl } from '@/domains/sessions/contract/feed-images'
import { projectFeed } from './feed-incremental'
import { transcriptMessage as message } from './transcript-test-fixtures'

test('projects tool result images into the historical Feed', () => {
  const image = checkedDataImageUrl('data:image/png;base64,AAAA')
  assert.notEqual(image, null)
  if (image === null) return
  const records = [
    message({
      uuid: 'call-record',
      blocks: [{ shape: 'tool', callId: 'call-1' }],
      toolCalls: [{ id: 'call-1', name: 'Read', input: {} }],
    }),
    message({
      uuid: 'result-record',
      role: 'user',
      answeredCalls: ['call-1'],
      toolResults: [
        {
          callId: 'call-1',
          failed: false,
          blocks: [
            { shape: 'text', text: 'before' },
            { shape: 'image', url: image },
            { shape: 'text', text: 'after' },
          ],
        },
      ],
    }),
  ]
  const chain: SessionChain = {
    id: 's',
    retiredIds: [],
    originUnread: false,
    files: [
      {
        path: 's.jsonl',
        sessionId: 's',
        resumedFrom: null,
        originSessionId: null,
        openedAt: '',
        openingPrompt: null,
        records,
        unreadableLines: 0,
      },
    ],
  }
  const rows = projectFeed(chain, undefined).rows
  assert.deepEqual(
    rows.map((row) => ({ shape: row.shape, source: row.shape === 'source' ? row.source : null })),
    [
      { shape: 'tool-group', source: null },
      { shape: 'source', source: 'data:image/png;base64,AAAA' },
    ],
  )
})
