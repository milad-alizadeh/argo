// The incremental projector must not rerun `rowsOfRecord` over records a previous poll already
// turned into rows (#2145): a row freezes once nothing later in the chain can still change it, and
// a frozen row is the very same object a later poll returns, never rebuilt equal-but-new.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionChain } from '@/domains/sessions/contract/model'
import type { SessionFeedRow } from '@/domains/sessions/contract/model'
import type {
  TranscriptMessage,
  TranscriptRecord,
} from '@/domains/sessions/contract/model/transcript'
import { transcriptMessage as message } from '../observation/transcript-test-fixtures'
import { projectFeed } from './feed-incremental'

function prose(uuid: string, text: string): TranscriptMessage {
  return message({ uuid, blocks: [{ shape: 'prose', text }] })
}

function toolCall(uuid: string, callId: string, _name: string): TranscriptMessage {
  return message({
    uuid,
    blocks: [{ shape: 'tool', callId }],
    toolCalls: [{ id: callId, kind: 'other', label: 'Ran a tool', text: null, source: null }],
  })
}

function toolResult(uuid: string, callId: string, content: string): TranscriptMessage {
  return message({
    uuid,
    toolResults: [{ callId, blocks: [{ shape: 'text', text: content }], failed: false }],
  })
}

function thoughts(uuid: string, ...texts: string[]): TranscriptMessage {
  return message({ uuid, blocks: texts.map((text) => ({ shape: 'thought', text })) })
}

function chainOf(id: string, records: TranscriptRecord[]): SessionChain {
  return {
    id,
    retiredIds: [],
    originUnread: false,
    files: [
      {
        path: `${id}.jsonl`,
        sessionId: id,
        resumedFrom: null,
        originSessionId: null,
        openedAt: '',
        openingPrompt: null,
        records,
        unreadableLines: 0,
      },
    ],
  }
}

test('a Tool Call with no result yet stays open, and freezes once resolved and no longer trailing', () => {
  const first = chainOf('s', [prose('a', 'First.'), toolCall('b', 'call-1', 'Bash')])
  const { state: afterCall, previouslyFrozenCount: initial } = projectFeed(first, undefined)
  assert.equal(initial, 0)
  // The prose row is safe; the Tool Call is not, since nothing has resolved it yet.
  assert.equal(afterCall.frozenRows.length, 1)

  const second = chainOf('s', [
    ...(first.files[0]?.records ?? []),
    toolResult('c', 'call-1', 'done'),
  ])
  const {
    rows: rowsAfterResult,
    state: afterResult,
    previouslyFrozenCount: afterResultFrozen,
  } = projectFeed(second, afterCall)
  assert.equal(afterResultFrozen, 1)
  assert.deepEqual(
    rowsAfterResult.map((row) => row.shape),
    ['prose', 'tool-group'],
  )
  // Resolved, but still the trailing row: a later poll's new Tool Call could still join its group.
  assert.equal(afterResult.frozenRows.length, 1)

  const third = chainOf('s', [...(second.files[0]?.records ?? []), prose('d', 'Third.')])
  const { rows, state: afterProse, previouslyFrozenCount } = projectFeed(third, afterResult)
  assert.equal(previouslyFrozenCount, 1)
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose', 'tool-group', 'prose'],
  )
  // A later, non-Tool row proves the group is closed, so it freezes now.
  assert.equal(afterProse.frozenRows.length, 3)
})

test('a frozen row is the same object a later poll returns, not rebuilt', () => {
  const chain = chainOf('s', [prose('a', 'First.'), prose('b', 'Second.')])
  const { rows: firstRows, state } = projectFeed(chain, undefined)

  const grown = chainOf('s', [...(chain.files[0]?.records ?? []), prose('c', 'Third.')])
  const { rows: secondRows } = projectFeed(grown, state)

  assert.equal(secondRows[0], firstRows[0])
  assert.equal(secondRows[1], firstRows[1])
})

test('a file rewritten in place resets rather than misreading the old cursor as still valid', () => {
  const chain = chainOf('s', [prose('a', 'First.')])
  const { state } = projectFeed(chain, undefined)

  const rewritten = chainOf('s', [prose('a2', 'Rewritten.')])
  const { rows } = projectFeed(rewritten, state)

  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose'],
  )
  assert.equal(rows[0]?.shape === 'prose' ? rows[0].text : null, 'Rewritten.')
})

// The full projection merges tool runs across adjacent Turns with nothing rendered between them
// (#2198, session-feed.test.ts "merges consecutive tool runs..."). The incremental path must reach
// the same merged group polling one record at a time, not only when it sees the whole chain at once.
test('merges consecutive tool runs across a poll boundary, the same way a full projection does', () => {
  const records: TranscriptRecord[] = [prose('a', 'Run the checks.')]
  let state: ReturnType<typeof projectFeed>['state'] | undefined
  let latestRows: SessionFeedRow[] = []
  for (const record of [
    toolCall('b', 'call-1', 'Bash'),
    toolCall('c', 'call-2', 'Bash'),
    toolResult('d', 'call-1', 'tests pass'),
    toolResult('e', 'call-2', 'types pass'),
    toolCall('f', 'call-3', 'Bash'),
    toolResult('g', 'call-3', 'formatting passes'),
  ]) {
    records.push(record)
    const chain = chainOf('s', [...records])
    const result = projectFeed(chain, state)
    state = result.state
    latestRows = result.rows
  }
  assert.deepEqual(
    latestRows.map((row) => row.shape),
    ['prose', 'tool-group'],
  )
  type ToolGroupRow = Extract<SessionFeedRow, { shape: 'tool-group' }>
  const group = latestRows.find((row) => row.shape === 'tool-group') as ToolGroupRow | undefined
  assert.equal(group?.calls.length, 3)
})

// Codex packs a whole reasoning item's several summary chunks into one record's blocks (#2410):
// folding them into one thought keeps the incremental read to one updating row, not a trail.
test('several reasoning-summary chunks in one record collapse to the latest, not a trail of rows', () => {
  const chain = chainOf('s', [thoughts('a', 'First chunk.', 'Second chunk.', 'Third chunk.')])
  const { rows } = projectFeed(chain, undefined)
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['thought'],
  )
  assert.equal(rows[0]?.shape === 'thought' ? rows[0].text : null, 'Third chunk.')
})
