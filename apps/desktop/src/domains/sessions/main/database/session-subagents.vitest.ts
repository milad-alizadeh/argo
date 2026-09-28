import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import { saveSessionBatch } from '../sync/session-sync-records'
import { refreshSessionSubagents, storedSessionSubagents } from './session-subagents'

let directory: string
let database: Database

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'argo-session-subagents-'))
  database = openDatabase(directory)
  database.$client.exec(
    "INSERT INTO project (id, path, common_directory) VALUES ('project-1', '/repo', '/repo/.git')",
  )
})

afterEach(async () => {
  database.$client.close()
  await rm(directory, { recursive: true, force: true })
})

function delegation(
  agentId: string,
  status: Extract<FeedContent, { kind: 'delegation' }>['status'],
  name: string | null,
): FeedContent {
  return {
    kind: 'delegation',
    id: `call-${agentId}`,
    agentId,
    status,
    name,
    prompt: null,
    model: null,
    summary: null,
  }
}

function argoId(nativeId: string): string {
  const row = database.$client
    .prepare('SELECT argo_id FROM session WHERE native_id = ?')
    .get(nativeId)
  if (typeof row?.argo_id !== 'string') throw new Error(`No Session ${nativeId}.`)
  return row.argo_id
}

function historyOf(histories: Record<string, FeedContent[]>, reads: SessionHistoryTarget[]) {
  return async (target: SessionHistoryTarget) => {
    reads.push(target)
    const content = histories[target.nativeId]
    if (content === undefined) throw new Error(`No history for ${target.nativeId}.`)
    return content
  }
}

test('stores the folded Subagents of each Project Session and reads each activity once', async () => {
  saveSessionBatch(database, 'claude', [
    { nativeId: 'parent', projectId: 'project-1', cwd: '/repo', activityAt: 10 },
    { nativeId: 'plain', projectId: 'project-1', cwd: '/repo', activityAt: 5 },
    { nativeId: 'unmatched', cwd: '/elsewhere', activityAt: 20 },
  ])
  const reads: SessionHistoryTarget[] = []
  const readHistory = historyOf(
    {
      parent: [
        { kind: 'message', id: 'prompt', role: 'user', text: 'Survey, then fix.' },
        delegation('agent-a', 'running', 'Survey'),
        delegation('agent-b', 'paused', null),
        delegation('agent-a', 'completed', 'Survey'),
      ],
      plain: [],
    },
    reads,
  )

  const result = await refreshSessionSubagents({
    database,
    harness: 'claude',
    readHistory,
    committed: () => {},
    stopped: () => false,
  })

  expect(result).toEqual({ read: 2, failed: 0 })
  expect(reads).toEqual([
    { nativeId: 'parent', subagentId: null, cwd: '/repo' },
    { nativeId: 'plain', subagentId: null, cwd: '/repo' },
  ])
  const parent = argoId('parent')
  expect(storedSessionSubagents(database, [parent, argoId('plain')])).toEqual(
    new Map([
      [
        parent,
        [
          { id: 'agent-a', label: 'Survey', state: 'completed' },
          { id: 'agent-b', label: null, state: 'running' },
        ],
      ],
    ]),
  )

  reads.length = 0
  await refreshSessionSubagents({
    database,
    harness: 'claude',
    readHistory,
    committed: () => {},
    stopped: () => false,
  })
  expect(reads).toEqual([])
})

test('rereads a Session whose activity moved and replaces what it stored', async () => {
  saveSessionBatch(database, 'codex', [
    { nativeId: 'parent', projectId: 'project-1', cwd: '/repo', activityAt: 10 },
  ])
  const histories: Record<string, FeedContent[]> = {
    parent: [delegation('agent-a', 'running', 'Survey')],
  }
  const refresh = () =>
    refreshSessionSubagents({
      database,
      harness: 'codex',
      readHistory: historyOf(histories, []),
      committed: () => {},
      stopped: () => false,
    })
  await refresh()
  histories.parent = [delegation('agent-b', 'failed', 'Fix')]
  saveSessionBatch(database, 'codex', [{ nativeId: 'parent', activityAt: 11 }])

  await refresh()

  expect(storedSessionSubagents(database, [argoId('parent')]).get(argoId('parent'))).toEqual([
    { id: 'agent-b', label: 'Fix', state: 'failed' },
  ])
})

test('counts an unreadable history, keeps the Session unread, and drops a read that outlives a stop', async () => {
  saveSessionBatch(database, 'claude', [
    { nativeId: 'broken', projectId: 'project-1', cwd: '/repo', activityAt: 30 },
    { nativeId: 'parent', projectId: 'project-1', cwd: '/repo', activityAt: 20 },
    { nativeId: 'later', projectId: 'project-1', cwd: '/repo', activityAt: 10 },
  ])
  const reads: SessionHistoryTarget[] = []
  let committed = 0

  const result = await refreshSessionSubagents({
    database,
    harness: 'claude',
    readHistory: historyOf(
      {
        parent: [delegation('agent-a', 'running', null)],
        later: [delegation('agent-c', 'running', null)],
      },
      reads,
    ),
    committed: () => {
      committed += 1
    },
    stopped: () => reads.length === 3,
  })

  expect(result).toEqual({ read: 1, failed: 1 })
  expect(reads.map((target) => target.nativeId)).toEqual(['broken', 'parent', 'later'])
  expect(committed).toBe(1)
  expect(storedSessionSubagents(database, [argoId('parent')]).get(argoId('parent'))).toHaveLength(1)
  const unread = database.$client
    .prepare('SELECT native_id FROM session WHERE subagents_read_at IS NULL ORDER BY native_id')
    .all()
    .map((row) => row.native_id)
  expect(unread).toEqual(['broken', 'later'])
})
