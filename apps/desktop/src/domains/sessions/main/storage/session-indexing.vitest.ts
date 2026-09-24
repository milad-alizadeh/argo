import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { readSessionIdentity } from './session-records'
import { indexSessionIngestions } from './session-upsert'

function indexedId(client: DatabaseSync, nativeId: string): string {
  const row = client.prepare('SELECT argo_id FROM session WHERE native_id = ?').get(nativeId)
  if (typeof row?.argo_id !== 'string') throw new Error('Session was not indexed.')
  return row.argo_id
}

function database() {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE project (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    common_directory TEXT NOT NULL
  );
  CREATE TABLE workspace (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    display_name TEXT NOT NULL,
    path TEXT NOT NULL,
    base_ref TEXT NOT NULL
  );
  CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    harness TEXT NOT NULL,
    native_id TEXT NOT NULL,
    project_id TEXT,
    vendor_title TEXT,
    working_directory TEXT,
    first_prompt TEXT,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);`)
  return { client, database: createDurableDatabase(client) }
}

test('maps an indexed working directory to its most specific Project path', () => {
  const { client, database: durable } = database()
  try {
    client
      .prepare('INSERT INTO project VALUES (?, ?, ?)')
      .run('00000000-0000-4000-8000-000000000099', '/repo', '/repo')
    client
      .prepare('INSERT INTO workspace VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        '00000000-0000-4000-8000-000000000098',
        '00000000-0000-4000-8000-000000000099',
        'main',
        'main',
        '/repo/worktree',
        'main',
      )
    indexSessionIngestions(durable, [
      {
        harness: 'codex',
        nativeId: 'thread-1',
        vendorTitle: 'Continue work',
        firstPrompt: null,
        updatedAt: 42,
        workingDirectory: '/repo/worktree/packages/desktop',
      },
    ])
    const id = indexedId(client, 'thread-1')
    assert.deepEqual(readSessionIdentity(durable, id), {
      argoId: id,
      harness: 'codex',
      nativeId: 'thread-1',
      projectId: '00000000-0000-4000-8000-000000000099',
      workingDirectory: '/repo/worktree/packages/desktop',
    })
  } finally {
    client.close()
  }
})

test('keeps Sessions outside a known Project unassigned', () => {
  const { client, database: durable } = database()
  try {
    indexSessionIngestions(durable, [
      {
        harness: 'claude',
        nativeId: '00000000-0000-4000-8000-000000000001',
        vendorTitle: null,
        firstPrompt: 'Continue work',
        updatedAt: 42,
        workingDirectory: '/outside',
      },
    ])
    const id = indexedId(client, '00000000-0000-4000-8000-000000000001')
    assert.equal(readSessionIdentity(durable, id)?.projectId, null)
  } finally {
    client.close()
  }
})

test('attaches a later discovered Project without changing the Argo ID', () => {
  const { client, database: durable } = database()
  try {
    const record = {
      harness: 'claude' as const,
      nativeId: '00000000-0000-4000-8000-000000000001',
      vendorTitle: null,
      firstPrompt: null,
      updatedAt: 42,
      workingDirectory: '/external/repository',
    }
    indexSessionIngestions(durable, [record])
    const originalId = indexedId(client, record.nativeId)
    client
      .prepare('INSERT INTO project VALUES (?, ?, ?)')
      .run('00000000-0000-4000-8000-000000000099', '/external', '/external')
    indexSessionIngestions(durable, [record])
    const laterId = indexedId(client, record.nativeId)
    assert.equal(laterId, originalId)
    assert.equal(
      readSessionIdentity(durable, laterId)?.projectId,
      '00000000-0000-4000-8000-000000000099',
    )
  } finally {
    client.close()
  }
})

test('rolls back a Session batch when its worker is cancelled', () => {
  const { client, database: durable } = database()
  try {
    const records = ['first', 'second'].map((nativeId) => ({
      harness: 'codex' as const,
      nativeId,
      vendorTitle: null,
      firstPrompt: null,
      updatedAt: 42,
      workingDirectory: null,
    }))
    let checks = 0
    assert.throws(() => indexSessionIngestions(durable, records, () => ++checks === 2), /cancelled/)
    assert.equal(client.prepare('SELECT count(*) AS count FROM session').get()?.count, 0)
  } finally {
    client.close()
  }
})
