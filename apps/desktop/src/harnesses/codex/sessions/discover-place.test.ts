import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { sessionListReplySchema } from '@/domains/sessions/contract/ipc/contract'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'

async function writeRollout(root: string, date: string, sessionId: string, records: unknown[]) {
  const day = path.join(root, ...date.split('-'))
  await mkdir(day, { recursive: true })
  await writeFile(
    path.join(day, `rollout-${date}T01-14-46-${sessionId}.jsonl`),
    records.map((record) => JSON.stringify(record)).join('\n'),
  )
}

// Codex writes the folder and branch a thread runs in on its `session_meta` record only, and a
// Project scopes the Roster by that folder (#2204); the branch is what names the Ticket.
test('reads the folder and branch a Codex Session runs in from its session_meta record', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-cwd-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const sessionId = '01a09d44-306e-7b00-b7c7-0391bb2ae350'
  await writeRollout(root, '2026-09-14', sessionId, [
    {
      timestamp: '2026-09-14T00:14:46.946Z',
      type: 'session_meta',
      payload: {
        id: sessionId,
        cwd: '/Users/x/proj',
        git: { commit_hash: 'abc', branch: 'argo/#2428-issue-completion', repository_url: '' },
      },
    },
    {
      timestamp: '2026-09-14T00:14:50.000Z',
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Open the proof.' },
    },
    // The thread then moved into a worktree, which only its commands name (#2376's Roster row).
    {
      timestamp: '2026-09-14T00:15:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        item: {
          type: 'CommandExecution',
          id: 'exec-1',
          command: ['/bin/zsh', '-lc', 'git status'],
          cwd: 'file:///Users/x/proj/.claude/worktrees/ticket-2376-session%20search',
          status: 'completed',
        },
      },
    },
  ])

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
    reply.sessions.map(({ id, cwd, branch }) => ({ id, cwd, branch })),
    [
      {
        id: sessionId,
        cwd: '/Users/x/proj/.claude/worktrees/ticket-2376-session search',
        branch: 'argo/#2428-issue-completion',
      },
    ],
  )
})

test('reads a desktop Codex custom tool worktree as the Session location', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-custom-place-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const sessionId = '01a0c193-3f66-7591-948e-7a0550d49061'
  const worktree = '/Users/x/proj/.claude/worktrees/ticket-2543-codex-custom-tool-place'
  await writeRollout(root, '2026-09-21', sessionId, [
    {
      timestamp: '2026-09-21T02:27:28.000Z',
      type: 'session_meta',
      payload: {
        id: sessionId,
        cwd: '/Users/x/proj',
        git: { commit_hash: 'abc', branch: 'main', repository_url: '' },
      },
    },
    {
      timestamp: '2026-09-21T02:27:30.000Z',
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        id: 'custom-1',
        call_id: 'call-1',
        name: 'exec',
        input: `const worktree = "${worktree}"; const result = await tools.exec_command({cmd:"git status",workdir:worktree});`,
      },
    },
  ])

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
    reply.sessions.map(({ id, cwd, branch }) => ({ id, cwd, branch })),
    [{ id: sessionId, cwd: worktree, branch: 'main' }],
  )
})
