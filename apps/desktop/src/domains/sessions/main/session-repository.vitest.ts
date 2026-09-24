import { mkdtemp as createTemporaryDirectory, rm as removeDirectory } from 'node:fs/promises'
import operatingSystem from 'node:os'
import filesystemPath from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { session } from '@/domains/sessions/next/main/schema'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { databaseMigrationsFolder } from '@/platform/main/storage/migrations-folder'
import { openSharedDatabase } from '@/platform/main/storage/shared-database'
import { appRouter } from '@/platform/main/trpc-router'
import { createSessionRepository } from './session-repository'
import { syncSessions } from './session-sync'
import { createSessionStarter } from './start-session'

const folders: string[] = []
afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((folder) => removeDirectory(folder, { recursive: true, force: true })),
  )
})

async function fixture() {
  const folder = await createTemporaryDirectory(
    filesystemPath.join(operatingSystem.tmpdir(), 'argo-session-repository-'),
  )
  folders.push(folder)
  const client = openSharedDatabase(folder, databaseMigrationsFolder())
  const database = createDurableDatabase(client)
  client.exec(
    "INSERT INTO project (id, path, common_directory) VALUES ('project-1', '/tmp/project-1', '/tmp/project-1/.git')",
  )
  client.exec("INSERT INTO project_selection (singleton, project_id) VALUES (1, 'project-1')")
  const removeTicketLink = async (argoId: string) => {
    client.prepare('DELETE FROM session_ticket_link WHERE session_id = ?').run(argoId)
  }
  const createRepository = () => createSessionRepository(database, removeTicketLink, () => 1_000)
  return { client, database, createRepository }
}

const discovered = {
  harness: 'claude' as const,
  nativeId: 'native-1',
  projectId: 'project-1',
  firstPrompt: 'Begin.',
}
const command = {
  harness: 'claude' as const,
  prompt: 'Begin.',
  workspace: { kind: 'main' as const },
}

function startWith(
  repository: ReturnType<Awaited<ReturnType<typeof fixture>>['createRepository']>,
  execute: () => Promise<unknown>,
) {
  return createSessionStarter({
    repository,
    projects: {
      resolveWorkspace: async () => ({ workspaceId: 'workspace-1', cwd: '/tmp/project-1' }),
      projectForWorkspace: () => 'project-1',
    } as never,
    adapters: { adapterFor: () => ({ execute }) } as never,
  })
}

test('vendor rediscovery keeps one Argo UUID and forks keep separate IDs', async () => {
  const value = await fixture()
  try {
    const first = value.createRepository().upsert(discovered)
    const repeated = value.createRepository().upsert(discovered)
    const fork = value.createRepository().upsert({ ...discovered, nativeId: 'fork-2' })
    const otherHarness = value.createRepository().upsert({ ...discovered, harness: 'codex' })
    expect(first).toBe(repeated)
    expect(fork).not.toBe(first)
    expect(otherHarness).not.toBe(first)
    expect(value.database.select().from(session).all()).toHaveLength(3)
  } finally {
    value.client.close()
  }
})

test('typed start shows the committed Argo UUID in Roster and detail', async () => {
  const value = await fixture()
  try {
    const start = startWith(value.createRepository(), async () => ({
      kind: 'accepted',
      projection: { session: { harness: 'claude', nativeId: 'native-1' } },
    }))
    const caller = appRouter.createCaller({
      database: value.database,
      selectedProjectId: () => 'project-1',
      startSession: start,
    })
    const result = await caller.sessions.start(command)
    expect(result.kind).toBe('started')
    if (result.kind !== 'started') throw new Error('Expected an Argo UUID')
    expect(
      (await caller.sessions.list({ page: 1, pageSize: 20 })).items.map((item) => item.argoId),
    ).toEqual([result.argoId])
    expect(await caller.sessions.detail({ argoId: result.argoId })).toMatchObject({
      argoId: result.argoId,
      posture: 'watched',
    })
  } finally {
    value.client.close()
  }
})

test('SQLite failure after vendor start stays uncertain until vendor sync, without prompt replay', async () => {
  const value = await fixture()
  try {
    const repository = value.createRepository()
    let sends = 0
    const start = startWith(repository, async () => {
      sends += 1
      return {
        kind: 'accepted',
        projection: { session: { harness: 'claude', nativeId: 'native-1' } },
      }
    })
    value.client.exec(
      "CREATE TRIGGER fail_session_insert BEFORE INSERT ON session BEGIN SELECT RAISE(FAIL, 'storage failed'); END",
    )
    expect(await start(command)).toEqual({ kind: 'uncertain' })
    expect(sends).toBe(1)
    value.client.exec('DROP TRIGGER fail_session_insert')
    expect(
      await syncSessions(
        value.createRepository(),
        {
          discoverSessions: async () => [
            {
              harness: 'claude',
              nativeId: 'native-1',
              workspaceId: 'workspace-1',
              firstPrompt: 'Begin.',
            },
          ],
          readKnownSession: async () => ({ kind: 'found' }),
        },
        { projectForWorkspace: () => 'project-1' },
      ),
    ).toEqual({ indexed: 1, unavailableWorkspaces: 0, failedWrites: 0 })
    expect(value.database.select().from(session).all()).toHaveLength(1)
    expect(sends).toBe(1)
  } finally {
    value.client.close()
  }
})

test('only exact authenticated permanent loss removes a Session and its Ticket link', async () => {
  const value = await fixture()
  try {
    const repository = value.createRepository()
    const argoId = repository.upsert(discovered)
    value.client
      .prepare(
        'INSERT INTO session_ticket_link (session_id, project_id, ticket_key, title, state, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(argoId, 'project-1', 'ARGO-1', 'Linked work', 'open', '2026-09-24T00:00:00.000Z')
    for (const kind of ['inaccessible', 'temporarily-unavailable', 'ambiguous', 'found'] as const) {
      expect(await repository.reconcileVendorReads(async () => ({ kind }))).toBe(0)
    }
    expect(
      await repository.reconcileVendorReads(async () => ({
        kind: 'permanently-unrecoverable',
        authenticated: true,
        harness: 'claude',
        nativeId: 'different-native-id',
      })),
    ).toBe(0)
    expect(value.database.select().from(session).all()).toHaveLength(1)
    expect(
      await repository.reconcileVendorReads(async () => ({
        kind: 'permanently-unrecoverable',
        authenticated: true,
        harness: 'claude',
        nativeId: 'native-1',
      })),
    ).toBe(1)
    expect(value.database.select().from(session).all()).toEqual([])
    expect(value.client.prepare('SELECT * FROM session_ticket_link').all()).toEqual([])
  } finally {
    value.client.close()
  }
})

test('sync counts malformed vendor rows and still indexes valid Sessions', async () => {
  const value = await fixture()
  try {
    expect(
      await syncSessions(
        value.createRepository(),
        {
          discoverSessions: async () => [
            { harness: 'claude', nativeId: '', workspaceId: 'workspace-1', firstPrompt: null },
            {
              harness: 'claude',
              nativeId: 'native-1',
              workspaceId: 'workspace-1',
              firstPrompt: null,
            },
          ],
          readKnownSession: async () => ({ kind: 'found' }),
        },
        { projectForWorkspace: () => 'project-1' },
      ),
    ).toEqual({ indexed: 1, unavailableWorkspaces: 0, failedWrites: 1 })
    expect(value.database.select().from(session).all()).toHaveLength(1)
  } finally {
    value.client.close()
  }
})

test.each(['missing-workspace', 'missing-project'] as const)(
  'typed start rejects %s before the Harness sends',
  async (caseName) => {
    const value = await fixture()
    try {
      let sends = 0
      const start = createSessionStarter({
        repository: value.createRepository(),
        projects: {
          resolveWorkspace: async () => {
            if (caseName === 'missing-workspace') throw new Error('Workspace removed')
            return { workspaceId: 'workspace-1', cwd: '/tmp/project-1' }
          },
          projectForWorkspace: () => null,
        } as never,
        adapters: {
          adapterFor: () => ({
            execute: async () => {
              sends += 1
              return { kind: 'uncertain' }
            },
          }),
        } as never,
      })
      const caller = appRouter.createCaller({ database: value.database, startSession: start })
      await expect(caller.sessions.start(command)).resolves.toEqual({
        kind: 'rejected',
        reason: 'The Workspace is unavailable.',
      })
      expect(sends).toBe(0)
    } finally {
      value.client.close()
    }
  },
)
