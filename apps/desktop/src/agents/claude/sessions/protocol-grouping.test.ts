import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from '@/agents/claude/sessions/records'
import type { TranscriptRecord } from '@/domains/sessions/contract/transcript'
import { projectFeed } from '@/domains/sessions/main/feed-incremental'

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

function harnessDelivery(
  uuid: string,
  content: string,
  { sidechain = false }: { sidechain?: boolean } = {},
) {
  const delivery = parseTranscriptLine(
    JSON.stringify({
      type: 'user',
      uuid,
      isSidechain: sidechain || undefined,
      userType: 'external',
      sourceToolAssistantUUID: 'tool-1',
      message: { role: 'user', content },
    }),
  )
  if (delivery === null) assert.fail('expected harness delivery to parse')
  return delivery
}

function chainWith(...records: TranscriptRecord[]) {
  return {
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
        records,
        unreadableLines: 0,
      },
    ],
  }
}

function projectionWith(delivery: ReturnType<typeof harnessDelivery>) {
  const chain = chainWith(
    commandMessage('command-1', 'call-1'),
    delivery,
    commandMessage('command-2', 'call-2'),
  )
  return projectFeed(chain, undefined).rows
}

test('keeps commands from distinct transcript events separate across a hidden delivery', () => {
  const delivery = harnessDelivery(
    'delivery-2',
    '<skills_instructions>internal update</skills_instructions>',
  )
  const rows = projectionWith(delivery)
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.shape, 'tool-group')
  assert.equal(rows[0]?.shape === 'tool-group' ? rows[0].calls.length : 0, 1)
  assert.equal(rows[1]?.shape, 'tool-group')
  assert.equal(rows[1]?.shape === 'tool-group' ? rows[1].calls.length : 0, 1)
})

test('keeps a reader event between command groups', () => {
  const delivery = harnessDelivery('status-2', '<status>running</status>')
  assert.deepEqual(
    projectionWith(delivery).map((row) => row.shape),
    ['tool-group', 'event', 'tool-group'],
  )
})

test('keeps a sidechain harness delivery out of the parent Feed', () => {
  const delivery = harnessDelivery('sidechain-status', '<status>running</status>', {
    sidechain: true,
  })
  const chain = chainWith(commandMessage('command-1', 'call-1'), delivery)
  assert.deepEqual(
    projectFeed(chain, undefined).rows.map((row) => row.shape),
    ['tool-group'],
  )
})
