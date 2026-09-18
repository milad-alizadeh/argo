import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { sessionListReplySchema } from '@/domains/sessions/contract/contract'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { codexSessionSource } from './read-sessions'

// Codex writes the folder a thread runs in on its `session_meta` record only, and a Project scopes
// the Roster by that folder (#2204).
test('reads the folder a Codex Session runs in from its session_meta record', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-cwd-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '14')
  await mkdir(day, { recursive: true })
  const sessionId = '01a09d44-306e-7b00-b7c7-0391bb2ae350'
  await writeFile(
    path.join(day, `rollout-2026-09-14T01-14-46-${sessionId}.jsonl`),
    [
      {
        timestamp: '2026-09-14T00:14:46.946Z',
        type: 'session_meta',
        payload: { id: sessionId, cwd: '/Users/x/proj' },
      },
      {
        timestamp: '2026-09-14T00:14:50.000Z',
        type: 'event_msg',
        payload: { type: 'user_message', message: 'Open the proof.' },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n'),
  )

  const reply = sessionListReplySchema.parse(
    await createSessionReader([codexSessionSource(root)]).listSessions({
      version: 1,
      type: 'session.list',
      requestId: 'list-1',
      projectRoot: null,
    }),
  )
  assert.equal(reply.type, 'session.listed')
  assert.deepEqual(
    reply.sessions.map(({ id, cwd }) => ({ id, cwd })),
    [{ id: sessionId, cwd: '/Users/x/proj' }],
  )
})
