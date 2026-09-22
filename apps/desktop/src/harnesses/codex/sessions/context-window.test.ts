import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { sessionListReplySchema } from '@/domains/sessions/contract/ipc/contract'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { codexSessionSource } from './read-sessions'

const listing = {
  version: 1 as const,
  type: 'session.list' as const,
  requestId: 'list-1',
  projectRoot: null,
}

test('uses the context window Codex declares for the session', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-context-window-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '16')
  await mkdir(day, { recursive: true })
  const sessionId = '01a0b000-0000-7000-8000-000000000001'
  await writeFile(
    path.join(day, `rollout-2026-09-16T00-00-00-${sessionId}.jsonl`),
    [
      {
        type: 'event_msg',
        payload: {
          type: 'task_started',
          turn_id: '01a0b000-0000-7000-8000-00000000a001',
          model_context_window: 258_400,
        },
      },
      {
        timestamp: '2026-09-16T00:00:01.000Z',
        type: 'event_msg',
        payload: { type: 'user_message', message: 'Inspect the session.' },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n'),
  )

  const reply = sessionListReplySchema.parse(
    await createSessionReader([codexSessionSource(root)]).listSessions(listing),
  )
  if (reply.type !== 'session.listed') throw new Error('Expected the session listing.')
  assert.deepEqual(
    reply.sessions.map(({ contextWindowTokens, id }) => ({ contextWindowTokens, id })),
    [{ contextWindowTokens: 258_400, id: sessionId }],
  )
})
