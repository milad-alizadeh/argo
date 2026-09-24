import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import type { ActorRefFrom } from 'xstate'
import type { SessionSupervisorActor } from '@/domains/sessions/main/live/session-supervisor-machine'
import type { CatalogActor } from '@/harnesses/catalog/catalog-read'
import type {
  CodexChannel,
  codexAppServerMachine,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { createAppRouter } from './trpc-router'

test('serves one validated indexed Session page', async () => {
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
  client
    .prepare('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      '00000000-0000-4000-8000-000000000001',
      'claude',
      'vendor-session',
      null,
      'Indexed Session',
      '/repo',
      'Review the change.',
      42,
    )
  try {
    const caller = createAppRouter({
      actor: {} as CatalogActor,
      sessions: {} as SessionSupervisorActor,
      database: createDurableDatabase(client),
      codex: {} as ActorRefFrom<typeof codexAppServerMachine>,
    }).createCaller({})
    await expect(caller.sessionPage({ page: 1, pageSize: 50, projectId: null })).resolves.toEqual({
      page: 1,
      pageSize: 50,
      indexedTotal: 1,
      sessions: [
        {
          argoId: '00000000-0000-4000-8000-000000000001',
          harness: 'claude',
          nativeId: 'vendor-session',
          projectId: null,
          vendorTitle: 'Indexed Session',
          firstPrompt: 'Review the change.',
          updatedAt: 42,
          workingDirectory: '/repo',
        },
      ],
    })
  } finally {
    client.close()
  }
})

function codexHistoryActor() {
  const channel: CodexChannel = {
    request: async (_method, _params, parse) =>
      parse({
        thread: {
          id: 'thread-1',
          status: { type: 'active', activeFlags: [] },
          turns: [
            {
              id: 'turn-1',
              items: [
                { id: 'user-1', type: 'userMessage', content: [{ type: 'text', text: 'Review.' }] },
              ],
            },
          ],
        },
      }),
    invalidMessageCount: () => 0,
    notify: () => {},
    respond: () => {},
    onNotification: () => {},
    onExit: () => {},
    close: () => {},
  }
  return {
    getSnapshot: () => ({ status: 'active' }),
    send: (event: { type: string; run?: (channel: CodexChannel) => void }) => event.run?.(channel),
  } as ActorRefFrom<typeof codexAppServerMachine>
}

test('returns selected Codex history and an unavailable composer state', async () => {
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
  client
    .prepare('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      '00000000-0000-4000-8000-000000000001',
      'codex',
      'thread-1',
      null,
      'Indexed Session',
      '/repo',
      null,
      42,
    )
  const codex = codexHistoryActor()
  const sessions = {
    getSnapshot: () => ({ context: { sessions: {} } }),
  } as SessionSupervisorActor
  try {
    const caller = createAppRouter({
      actor: {} as CatalogActor,
      sessions,
      database: createDurableDatabase(client),
      codex,
    }).createCaller({})
    await expect(
      caller.sessionFeed({ sessionId: '00000000-0000-4000-8000-000000000001' }),
    ).resolves.toEqual({
      result: 'history',
      harness: 'codex',
      availability: {
        state: 'unavailable',
        reason: 'This Codex Session is active in another app.',
      },
      live: false,
      entries: [{ sourceId: 'user-1', role: 'user', text: 'Review.' }],
    })
  } finally {
    client.close()
  }
})
