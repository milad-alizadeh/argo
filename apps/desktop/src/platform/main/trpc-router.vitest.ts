import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { type ActorRefFrom, createActor, fromPromise } from 'xstate'
import type { SessionSupervisorActor } from '@/domains/sessions/main/live/session-supervisor-machine'
import { sessionSyncMachine } from '@/domains/sessions/main/sync/session-sync-machine'
import type { CatalogActor } from '@/harnesses/catalog/catalog-read'
import type {
  CodexChannel,
  codexAppServerMachine,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { createAppRouter } from './trpc-router'

test('lists validated indexed Sessions', async () => {
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
      sync: {} as Record<'claude' | 'codex', ActorRefFrom<typeof sessionSyncMachine>>,
    }).createCaller({})
    await expect(caller.sessions.list({ page: 1, pageSize: 50, projectId: null })).resolves.toEqual(
      {
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
      },
    )
    await expect(
      caller.sessions.ensure({ harness: 'claude', nativeId: 'vendor-session' }),
    ).resolves.toEqual({ argoId: '00000000-0000-4000-8000-000000000001' })
  } finally {
    client.close()
  }
})

function codexHistoryActor() {
  const channel: CodexChannel = {
    request: async (method, _params, parse) =>
      parse(
        method === 'thread/loaded/list'
          ? { data: [], nextCursor: null }
          : {
              thread: {
                id: 'thread-1',
                status: { type: 'active', activeFlags: [] },
                turns: [
                  {
                    id: 'turn-1',
                    items: [
                      {
                        id: 'user-1',
                        type: 'userMessage',
                        content: [{ type: 'text', text: 'Review.' }],
                      },
                    ],
                  },
                ],
              },
            },
      ),
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
      sync: {} as Record<'claude' | 'codex', ActorRefFrom<typeof sessionSyncMachine>>,
    }).createCaller({})
    await expect(
      caller.sessionFeed({ sessionId: '00000000-0000-4000-8000-000000000001' }),
    ).resolves.toEqual({
      version: 1,
      type: 'session.feed.read',
      requestId: '00000000-0000-4000-8000-000000000001',
      sessionId: '00000000-0000-4000-8000-000000000001',
      chainId: '00000000-0000-4000-8000-000000000001',
      revision: '["user-1"]',
      rows: [{ shape: 'prose', id: 'user-1', role: 'user', text: 'Review.' }],
      harness: 'codex',
      availability: {
        state: 'unavailable',
        reason: 'This Codex Session is active in another app.',
      },
      live: false,
    })
  } finally {
    client.close()
  }
})

test('priority sync saves a missing vendor Session before returning its Argo ID', async () => {
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
  const sync = createActor(
    sessionSyncMachine.provide({
      actors: {
        sync: fromPromise(async ({ input }) => {
          if (input.priorityNativeId !== null)
            client
              .prepare('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(
                '00000000-0000-4000-8000-000000000001',
                'claude',
                input.priorityNativeId,
                null,
                null,
                '/repo',
                null,
                1,
              )
          return {
            cursor: null,
            generation: input.generation,
            indexedCount: 1,
            invalidRecordCount: 0,
          }
        }),
      },
    }),
    { input: {} },
  ).start()
  try {
    const caller = createAppRouter({
      actor: {} as CatalogActor,
      sessions: {} as SessionSupervisorActor,
      database: createDurableDatabase(client),
      codex: {} as ActorRefFrom<typeof codexAppServerMachine>,
      sync: { claude: sync, codex: sync },
    }).createCaller({})
    await expect(
      caller.sessions.ensure({ harness: 'claude', nativeId: 'vendor-session' }),
    ).resolves.toEqual({ argoId: '00000000-0000-4000-8000-000000000001' })
  } finally {
    sync.stop()
    client.close()
  }
})

test('reports one Harness failure without hiding the other Harness state', async () => {
  const source = (failure: string | null) =>
    ({
      getSnapshot: () => ({
        matches: (state: string) => state === 'Waiting',
        context: {
          indexedCount: failure === null ? 4 : 2,
          invalidRecordCount: 0,
          refreshedAt: 42,
          failure,
        },
      }),
    }) as unknown as ActorRefFrom<typeof sessionSyncMachine>
  const caller = createAppRouter({
    actor: {} as CatalogActor,
    sessions: {} as SessionSupervisorActor,
    database: {} as ReturnType<typeof createDurableDatabase>,
    codex: {} as ActorRefFrom<typeof codexAppServerMachine>,
    sync: { claude: source('Claude unavailable'), codex: source(null) },
  }).createCaller({})
  await expect(caller.sessionSyncStatus()).resolves.toEqual({
    claude: {
      state: 'waiting',
      indexedCount: 2,
      invalidRecordCount: 0,
      refreshedAt: 42,
      failure: 'Claude unavailable',
    },
    codex: {
      state: 'waiting',
      indexedCount: 4,
      invalidRecordCount: 0,
      refreshedAt: 42,
      failure: null,
    },
  })
})
