import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionChain } from '@/domains/sessions/contract/model'
import { checkedDataImageUrl } from '@/domains/sessions/contract/model/feed'
import { transcriptMessage as message } from '../observation/transcript-test-fixtures'
import { projectFeed } from './feed-incremental'
import { readCall } from './tool-feed-test-fixtures'

test('projects tool result images into the historical Feed', () => {
  const image = checkedDataImageUrl('data:image/png;base64,AAAA')
  assert.notEqual(image, null)
  if (image === null) return
  const records = [
    message({
      uuid: 'call-record',
      blocks: [{ shape: 'tool', callId: 'call-1' }],
      toolCalls: [readCall('call-1', 'a.png')],
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
    rows.map((row) => ({ shape: row.shape, source: row.shape === 'image' ? row.source : null })),
    [
      { shape: 'tool-group', source: null },
      { shape: 'image', source: 'data:image/png;base64,AAAA' },
    ],
  )
})
