import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { readSession, readSessionList } from './session-records'

function database() {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    harness TEXT NOT NULL,
    native_id TEXT NOT NULL,
    project_id TEXT,
    vendor_title TEXT,
    working_directory TEXT,
    first_prompt TEXT,
    updated_at INTEGER NOT NULL
  );`)
  return { client, database: createDurableDatabase(client) }
}

test('lists a numbered SQL window in stable activity order', () => {
  const { client, database: durable } = database()
  try {
    const insert = client.prepare('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run('00000000-0000-4000-8000-000000000001', 'claude', 'one', null, null, null, null, 2)
    insert.run('00000000-0000-4000-8000-000000000002', 'codex', 'two', null, null, null, null, 3)
    insert.run('00000000-0000-4000-8000-000000000003', 'claude', 'three', null, null, null, null, 2)
    assert.deepEqual(
      readSessionList(durable, { page: 1, pageSize: 2, projectId: null, search: '' }),
      {
        page: 1,
        pageSize: 2,
        indexedTotal: 3,
        sessions: [
          {
            argoId: '00000000-0000-4000-8000-000000000002',
            harness: 'codex',
            nativeId: 'two',
            projectId: null,
            vendorTitle: null,
            firstPrompt: null,
            updatedAt: 3,
            workingDirectory: null,
          },
          {
            argoId: '00000000-0000-4000-8000-000000000001',
            harness: 'claude',
            nativeId: 'one',
            projectId: null,
            vendorTitle: null,
            firstPrompt: null,
            updatedAt: 2,
            workingDirectory: null,
          },
        ],
      },
    )
  } finally {
    client.close()
  }
})

test('reads the selected Session by its Argo ID outside the loaded page', () => {
  const { client, database: durable } = database()
  try {
    client
      .prepare('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        '00000000-0000-4000-8000-000000000003',
        'claude',
        'native-three',
        null,
        'Vendor title',
        '/project',
        'First prompt',
        5,
      )
    assert.deepEqual(readSession(durable, '00000000-0000-4000-8000-000000000003'), {
      argoId: '00000000-0000-4000-8000-000000000003',
      harness: 'claude',
      nativeId: 'native-three',
      projectId: null,
      vendorTitle: 'Vendor title',
      firstPrompt: 'First prompt',
      updatedAt: 5,
      workingDirectory: '/project',
    })
  } finally {
    client.close()
  }
})

test('searches all indexed Session metadata before paging', () => {
  const { client, database: durable } = database()
  try {
    const insert = client.prepare('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run(
      '00000000-0000-4000-8000-000000000001',
      'claude',
      'one',
      null,
      'Alpha',
      null,
      null,
      9,
    )
    insert.run('00000000-0000-4000-8000-000000000002', 'codex', 'two', null, 'Beta', null, null, 8)
    insert.run(
      '00000000-0000-4000-8000-000000000003',
      'claude',
      'three',
      null,
      null,
      null,
      'Find me',
      7,
    )
    const page = readSessionList(durable, {
      page: 1,
      pageSize: 1,
      projectId: null,
      search: 'find',
    })
    assert.equal(page.indexedTotal, 1)
    assert.deepEqual(
      page.sessions.map(({ nativeId }) => nativeId),
      ['three'],
    )
  } finally {
    client.close()
  }
})
