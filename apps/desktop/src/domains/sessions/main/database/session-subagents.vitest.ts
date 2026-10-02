import { afterEach, beforeEach, expect, test } from 'vitest'
import type { Database } from '@/database/database'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { insertProject, migratedDatabase } from '@/mocks/database/migrated-database'
import { saveSessionBatch } from '../sync'
import {
  saveDiscoveredSessionSubagents,
  saveSessionSubagents,
  storedSessionSubagents,
} from './session-subagents'

let database: Database

beforeEach(() => {
  database = migratedDatabase()
  insertProject(database, 'project-1', '/repo')
})

afterEach(() => {
  database.$client.close()
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

test('records a running Session’s Subagents', () => {
  saveSessionBatch(database, {
    harness: 'claude',
    records: [{ nativeId: 'parent', projectId: 'project-1', cwd: '/repo', activityAt: 10 }],
  })
  const parent = argoId('parent')

  expect(saveSessionSubagents(database, parent, [delegation('agent-a', 'running', 'Survey')])).toBe(
    1,
  )
  expect(saveSessionSubagents(database, parent, [delegation('agent-a', 'running', null)])).toBe(0)
  saveSessionSubagents(database, parent, [delegation('agent-a', 'completed', null)])

  expect(storedSessionSubagents(database, [parent]).get(parent)).toEqual([
    { id: 'agent-a', label: 'Survey', state: 'completed' },
  ])
})

test('a later ID scan adds children without downgrading known states', () => {
  saveSessionBatch(database, {
    harness: 'claude',
    records: [{ nativeId: 'parent', projectId: 'project-1', cwd: '/repo', activityAt: 10 }],
  })
  const parent = argoId('parent')
  saveSessionSubagents(database, parent, [delegation('agent-a', 'completed', 'Review')])
  expect(saveDiscoveredSessionSubagents(database, parent, ['agent-a', 'agent-b'])).toBe(1)
  expect(storedSessionSubagents(database, [parent]).get(parent)).toEqual([
    { id: 'agent-a', label: 'Review', state: 'completed' },
    { id: 'agent-b', label: null, state: 'unknown' },
  ])
})
