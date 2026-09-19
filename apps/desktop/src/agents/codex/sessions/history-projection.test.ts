import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { codexSessionSource } from '@/agents/codex/sessions/read-sessions'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { fed, feedRequest, listed, rowsOf } from '@/domains/sessions/main/reader-test-helpers'

async function readerFor(
  context: { after: (cleanup: () => Promise<void>) => void },
  sessionId: string,
  records: unknown[],
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-history-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '16')
  await mkdir(day, { recursive: true })
  await writeFile(
    path.join(day, `rollout-2026-09-16T00-00-00-${sessionId}.jsonl`),
    records.map((record) => JSON.stringify(record)).join('\n'),
  )
  return createSessionReader([codexSessionSource(root)])
}

const prompt = {
  timestamp: '2026-09-16T00:00:01.000Z',
  type: 'event_msg',
  payload: { type: 'user_message', message: 'Inspect the session.' },
}

test('projects completed root Turn setup and cumulative usage', async (context) => {
  const sessionId = '01a0b000-0000-7000-8000-000000000101'
  const reader = await readerFor(context, sessionId, [
    prompt,
    {
      type: 'turn_context',
      payload: {
        turn_id: 'turn-1',
        root_turn_id: 'turn-1',
        model: 'gpt-6-astra',
        effort: 'high',
        collaboration_mode: { mode: 'Default' },
      },
    },
    {
      type: 'token_usage_record',
      payload: {
        turn_token_usage: { total_tokens: 1000 },
        thread_token_usage: { total_tokens: 3000 },
      },
    },
    {
      type: 'token_usage_record',
      payload: {
        turn_token_usage: { total_tokens: 1200 },
        thread_token_usage: { total_tokens: 4500 },
      },
    },
    {
      timestamp: '2026-09-16T00:00:10.000Z',
      type: 'event_msg',
      payload: { type: 'task_complete', turn_id: 'turn-1' },
    },
  ])
  const session = (await listed(reader))?.sessions[0]
  assert.deepEqual(
    session === undefined
      ? null
      : {
          status: session.status,
          setup: session.setup,
          contextTokens: session.contextTokens,
          spentTokens: session.spentTokens,
        },
    {
      status: 'idle',
      setup: { model: 'gpt-6-astra', effort: 'high', mode: 'Default' },
      contextTokens: 1200,
      spentTokens: 4500,
    },
  )
})

test('projects one interruption marker for an aborted Turn', async (context) => {
  const sessionId = '01a0b000-0000-7000-8000-000000000102'
  const reader = await readerFor(context, sessionId, [
    prompt,
    {
      timestamp: '2026-09-16T00:00:02.000Z',
      type: 'event_msg',
      payload: { type: 'turn_aborted', turn_id: 'turn-1' },
    },
  ])
  const rows = rowsOf(await fed(reader, feedRequest(sessionId)))
  assert.equal((await listed(reader))?.sessions[0]?.status, 'idle')
  assert.deepEqual(
    rows.filter((row) => row.shape === 'marker').map((row) => row.marker),
    ['interrupted'],
  )
})
