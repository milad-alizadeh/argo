import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type Database, databaseMigrationsFolder, openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { saveSessionBatch } from '@/domains/sessions/main/sync/session-sync-records'
import { type AppRouterDependencies, createAppRouter } from './trpc-router'

let userData: string
let database: Database

function routerDependencies(
  sessions: Partial<AppRouterDependencies['sessions']> = {},
): AppRouterDependencies {
  return {
    accounts: {},
    catalog: {},
    harnessSignIn: {},
    projects: { database },
    sessions: {
      database,
      supervisor: { getSnapshot: () => ({ context: { sessions: {} } }), send: () => {} },
      ...sessions,
    },
    tickets: {},
    workspaces: { database },
  } as unknown as AppRouterDependencies
}

beforeEach(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'argo-session-router-'))
  database = openDatabase(userData, { migrationsFolder: databaseMigrationsFolder() })
})

afterEach(async () => {
  database.$client.close()
  await rm(userData, { recursive: true, force: true })
})

test('registers the paged Session list on the global router', async () => {
  database
    .insert(project)
    .values({ id: 'project-1', path: '/work/one', commonDirectory: '/work/one/.git' })
    .run()
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000001',
      harness: 'claude',
      nativeId: 'native-1',
      projectId: 'project-1',
      firstPrompt: 'Open the saved Session',
    })
    .run()
  await expect(
    createAppRouter(routerDependencies())
      .createCaller({})
      .sessionList({ projectId: 'project-1', page: 1, pageSize: 30 }),
  ).resolves.toMatchObject({
    page: 1,
    pageSize: 30,
    total: 1,
    rows: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        harness: 'claude',
        title: { text: 'Open the saved Session', source: 'first-prompt' },
      },
    ],
  })
})

test('reads historical Feed content through the saved Session Harness adapter', async () => {
  const sessionId = '00000000-0000-4000-8000-000000000003'
  database
    .insert(sessionTable)
    .values({
      argoId: sessionId,
      harness: 'claude',
      nativeId: 'vendor-session',
      cwd: '/work/project',
    })
    .run()
  const reads: unknown[] = []
  const dependencies = routerDependencies({
    readHistory: async (harness, target) => {
      reads.push({ harness, target })
      return [{ kind: 'message', id: 'message-1', role: 'user', text: 'Hello' }]
    },
  })

  const reply = await createAppRouter(dependencies).createCaller({}).sessionFeedRead({ sessionId })
  expect(reply).toMatchObject({
    type: 'session.feed.read',
    sessionId,
    content: [{ kind: 'message', role: 'user', text: 'Hello' }],
  })
  expect(reply).not.toHaveProperty('rows')
  expect(reads).toEqual([
    {
      harness: 'claude',
      target: { nativeId: 'vendor-session', subagentId: null, cwd: '/work/project' },
    },
  ])
})

test('reads a selected subagent through its parent Harness and retains the Session chain', async () => {
  const sessionId = '00000000-0000-4000-8000-000000000005'
  database
    .insert(sessionTable)
    .values({
      argoId: sessionId,
      harness: 'codex',
      nativeId: 'root-thread',
      cwd: '/work/project',
    })
    .run()
  const targets: unknown[] = []
  const dependencies = routerDependencies({
    readHistory: async (harness, target) => {
      targets.push({ harness, target })
      return [{ kind: 'message', id: 'child-message', role: 'assistant', text: 'Child result' }]
    },
  })

  await expect(
    createAppRouter(dependencies).createCaller({}).sessionFeedRead({
      sessionId,
      subagentId: 'child-thread',
    }),
  ).resolves.toMatchObject({
    sessionId,
    chainId: 'child-thread',
    content: [{ id: 'child-message', text: 'Child result' }],
  })
  expect(targets).toEqual([
    {
      harness: 'codex',
      target: { nativeId: 'root-thread', subagentId: 'child-thread', cwd: '/work/project' },
    },
  ])
})

test('uses vendor Feed pages when the registered Harness provides them', async () => {
  const sessionId = '00000000-0000-4000-8000-000000000007'
  database
    .insert(sessionTable)
    .values({
      argoId: sessionId,
      harness: 'codex',
      nativeId: 'thread-1',
    })
    .run()
  const reads: unknown[] = []
  const caller = createAppRouter(
    routerDependencies({
      readHistory: async () => {
        throw new Error('Full history was read.')
      },
      readHistoryPage: async (harness, target, before) => {
        reads.push({ harness, target, before })
        return {
          content: [{ kind: 'message', id: 'reply-1', role: 'assistant', text: 'Done' }],
          olderCursor: 'vendor-older',
        }
      },
    }),
  ).createCaller({})
  const newest = await caller.sessionFeedRead({ sessionId })
  expect(newest).toMatchObject({
    content: [{ id: 'reply-1', text: 'Done' }],
    olderCursor: 'vendor-older',
  })
  await caller.sessionFeedRead({ sessionId, before: 'vendor-older' })
  expect(reads.map((read) => (read as { before: string | null }).before)).toEqual([
    null,
    'vendor-older',
  ])
})

test('reports a failed vendor history read instead of confirming an empty Feed', async () => {
  const sessionId = '00000000-0000-4000-8000-000000000006'
  database
    .insert(sessionTable)
    .values({ argoId: sessionId, harness: 'claude', nativeId: 'root' })
    .run()
  const dependencies = routerDependencies({
    readHistory: async () => {
      throw new Error('offline')
    },
  })

  await expect(
    createAppRouter(dependencies).createCaller({}).sessionFeedRead({ sessionId }),
  ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: 'vendor-history-unavailable' })
})

test('renames a saved Session through sessionRename after the Harness accepts it', async () => {
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000002',
      harness: 'claude',
      nativeId: 'native-rename',
      customTitle: 'Before',
    })
    .run()
  const renamed: unknown[] = []
  const dependencies = routerDependencies({
    rename: async (request) => {
      renamed.push(request)
    },
  })

  await expect(
    createAppRouter(dependencies).createCaller({}).sessionRename({
      sessionId: '00000000-0000-4000-8000-000000000002',
      title: 'Confirmed title',
    }),
  ).resolves.toEqual({ title: 'Confirmed title' })
  expect(renamed).toEqual([
    {
      harness: 'claude',
      nativeId: 'native-rename',
      title: 'Confirmed title',
    },
  ])
  expect(
    database
      .select({ customTitle: sessionTable.customTitle })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, '00000000-0000-4000-8000-000000000002'))
      .get(),
  ).toEqual({ customTitle: 'Confirmed title' })
})

test('keeps the existing title when the Harness rejects a rename', async () => {
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000003',
      harness: 'claude',
      nativeId: 'native-rejected-rename',
      customTitle: 'Before',
    })
    .run()
  const dependencies = routerDependencies({
    rename: async () => {
      throw new Error('Harness rejected the rename.')
    },
  })

  await expect(
    createAppRouter(dependencies).createCaller({}).sessionRename({
      sessionId: '00000000-0000-4000-8000-000000000003',
      title: 'Rejected title',
    }),
  ).rejects.toThrow('Harness rejected the rename.')
  expect(
    database
      .select({ customTitle: sessionTable.customTitle })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, '00000000-0000-4000-8000-000000000003'))
      .get(),
  ).toEqual({ customTitle: 'Before' })
})

test('accepts a later Harness sync that changes or clears a confirmed custom title', async () => {
  database
    .insert(sessionTable)
    .values({
      argoId: '00000000-0000-4000-8000-000000000004',
      harness: 'claude',
      nativeId: 'native-synced-rename',
    })
    .run()
  const dependencies = routerDependencies({ rename: async () => undefined })
  const caller = createAppRouter(dependencies).createCaller({})

  await caller.sessionRename({
    sessionId: '00000000-0000-4000-8000-000000000004',
    title: 'Confirmed title',
  })
  saveSessionBatch(database, 'claude', [
    { nativeId: 'native-synced-rename', customTitle: 'Changed by the Harness' },
  ])
  expect(
    database
      .select({ customTitle: sessionTable.customTitle })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, '00000000-0000-4000-8000-000000000004'))
      .get(),
  ).toEqual({ customTitle: 'Changed by the Harness' })

  saveSessionBatch(database, 'claude', [{ nativeId: 'native-synced-rename', customTitle: null }])
  expect(
    database
      .select({ customTitle: sessionTable.customTitle })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, '00000000-0000-4000-8000-000000000004'))
      .get(),
  ).toEqual({ customTitle: null })
})
