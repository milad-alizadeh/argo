import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createSessionReader } from '@/domains/sessions/main/observation/reader/reader'
import { projectRosterRow } from '@/domains/sessions/main/projection/roster/roster'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'

function activity(kind: 'started' | 'completed', timestamp: string, subagentId: string) {
  return {
    type: 'event_msg',
    timestamp,
    payload: {
      type: 'item_completed',
      item: {
        type: 'SubAgentActivity',
        id: `activity-${kind}`,
        kind,
        agent_thread_id: subagentId,
        agent_path: '/root/review_feed',
      },
    },
  }
}

async function writeBackgroundAgent(root: string, sessionId: string, subagentId: string) {
  const day = path.join(root, '2026', '09', '16')
  await mkdir(day, { recursive: true })
  await writeFile(
    path.join(day, `rollout-2026-09-16T21-23-13-${sessionId}.jsonl`),
    [
      activity('started', '2026-09-16T21:23:34.000Z', subagentId),
      activity('completed', '2026-09-16T21:24:46.000Z', subagentId),
    ]
      .map((record) => JSON.stringify(record))
      .join('\n'),
  )
  await writeFile(
    path.join(day, `rollout-2026-09-16T21-23-34-${subagentId}.jsonl`),
    [
      { type: 'turn_context', payload: { model: 'gpt-5.6-terra' } },
      {
        type: 'token_usage_record',
        payload: {
          thread_token_usage: { input_tokens: 2000, cached_input_tokens: 500, output_tokens: 700 },
        },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n'),
  )
}

test('reads a Codex background agent duration and token usage', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-delegation-usage-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const sessionId = '01a0abe3-4484-7271-9336-9c4dc2be9f7b'
  const subagentId = '01a0abe3-96a2-7272-8db3-d24dbf36d454'
  await writeBackgroundAgent(root, sessionId, subagentId)

  const reader = createSessionReader([codexSessionSource(root)])
  const usage = await reader.readSubagentUsage({
    version: 1,
    type: 'session.subagent.usage',
    requestId: 'usage-1',
    sessionId,
  })
  assert.deepEqual(usage.type === 'session.subagent.usage.read' ? usage.usage : null, [
    { id: subagentId, tokens: 2200, model: 'gpt-5.6-terra' },
  ])

  const chain = await codexSessionSource(root).readSessionFiles(sessionId)
  assert.ok(chain !== null)
  assert.deepEqual(projectRosterRow(chain, 'codex').subagents, [
    {
      id: subagentId,
      label: 'Review feed',
      state: 'completed',
      startedAt: '2026-09-16T21:23:34.000Z',
      endedAt: '2026-09-16T21:24:46.000Z',
    },
  ])
})
