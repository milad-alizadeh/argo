import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import { saveSessionBatch } from '../sync/session-sync-records'
import { recordLiveSubagents, storedSessionSubagents } from './session-subagents'

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
    id: `call-${agentId}:${status}`,
    event: ['completed', 'failed', 'interrupted'].includes(status) ? 'responded' : 'started',
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

function contentEvent(content: FeedContent): SessionLiveEventBody {
  return { type: 'content', commandId: null, turnId: null, vendorEventId: null, content }
}

test('records a running Session’s Subagents', () => {
  saveSessionBatch(database, 'claude', [
    { nativeId: 'parent', projectId: 'project-1', cwd: '/repo', activityAt: 10 },
  ])
  const parent = argoId('parent')

  recordLiveSubagents(database, {
    harness: 'claude',
    nativeId: 'parent',
    events: [contentEvent(delegation('agent-a', 'running', 'Survey'))],
  })
  recordLiveSubagents(database, {
    harness: 'claude',
    nativeId: 'parent',
    events: [contentEvent(delegation('agent-a', 'completed', null))],
  })

  expect(storedSessionSubagents(database, [parent]).get(parent)).toEqual([
    { id: 'agent-a', label: 'Survey', state: 'completed' },
  ])
})

test('ignores a live Subagent whose Session is not stored', () => {
  recordLiveSubagents(database, {
    harness: 'claude',
    nativeId: 'absent',
    events: [contentEvent(delegation('agent-a', 'running', null))],
  })

  expect(database.$client.prepare('SELECT count(*) AS rows FROM session_subagent').get()).toEqual({
    rows: 0,
  })
})
