import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  managedSessionLease,
  session,
  sessionLaunchIntent,
} from '@/domains/sessions/next/main/schema'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { databaseMigrationsFolder } from '@/platform/main/storage/migrations-folder'
import { openSharedDatabase } from '@/platform/main/storage/shared-database'
import { appRouter } from '@/platform/main/trpc-router'
import { createSessionIdentityService } from './session-identity-service'
import { recoverSessionState } from './session-recovery'
import { createSessionStarter } from './start-session'

const folders: string[] = []
afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

async function harness() {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-session-identity-'))
  folders.push(folder)
  const client = openSharedDatabase(folder, databaseMigrationsFolder())
  const database = createDurableDatabase(client)
  client.exec(
    "INSERT INTO project (id, path, common_directory) VALUES ('project-1', '/tmp/project-1', '/tmp/project-1/.git')",
  )
  const removeTicketLink = async (sessionId: string) => {
    client.prepare('DELETE FROM session_ticket_link WHERE session_id = ?').run(sessionId)
  }
  const create = () => createSessionIdentityService(database, removeTicketLink, () => 1_000)
  return { client, database, create }
}

const discovery = {
  harness: 'claude' as const,
  nativeId: 'native-1',
  projectId: 'project-1',
  firstPrompt: 'Begin.',
}
const launch = {
  harness: 'claude' as const,
  projectId: 'project-1',
  workspaceId: 'workspace-1',
  prompt: 'Begin.',
}

test('repeated discovery and restart keep one Argo UUID; forks keep separate IDs', async () => {
  const fixture = await harness()
  try {
    const first = fixture.create().reconcile(discovery)
    const second = fixture.create().reconcile(discovery)
    const fork = fixture.create().reconcile({ ...discovery, nativeId: 'fork-native-2' })
    const otherHarness = fixture.create().reconcile({ ...discovery, harness: 'codex' })
    expect(first).toBe(second)
    expect(fork).not.toBe(first)
    expect(otherHarness).not.toBe(first)
    expect(fixture.database.select().from(session).all()).toHaveLength(3)
  } finally {
    fixture.client.close()
  }
})

test('an interrupted launch rediscovers through the vendor without replaying the prompt', async () => {
  const fixture = await harness()
  try {
    const intentId = fixture.create().beginLaunch(launch)
    const restarted = fixture.create()
    const recovered = await restarted.recoverLaunches(async (intent) => {
      expect(intent).toMatchObject({ id: intentId, nativeId: null, prompt: 'Begin.' })
      return { kind: 'found', nativeId: 'native-1' }
    })
    expect(recovered).toHaveLength(1)
    expect(
      await restarted.recoverLaunches(async () => {
        throw new Error('No second vendor call')
      }),
    ).toEqual([])
    expect(fixture.database.select().from(session).all()[0]?.argoId).toBe(recovered[0])
  } finally {
    fixture.client.close()
  }
})

test('a vendor start followed by a SQLite failure remains uncertain and recovers by native ID', async () => {
  const fixture = await harness()
  try {
    const service = fixture.create()
    const intentId = service.beginLaunch(launch)
    service.rememberVendorStart(intentId, 'native-1')
    fixture.client.exec(
      "CREATE TRIGGER fail_session_insert BEFORE INSERT ON session BEGIN SELECT RAISE(FAIL, 'storage failed'); END",
    )
    expect(() => service.commitLaunch(intentId, 'native-1')).toThrow('Failed query')
    expect(service.isUnsafe()).toBe(true)
    expect(() => service.beginLaunch(launch)).toThrow('unsafe')
    fixture.client.exec('DROP TRIGGER fail_session_insert')
    await recoverSessionState(service, {
      discoverLaunch: async () => {
        throw new Error('The known native ID should be used')
      },
      readKnownSession: async () => ({ kind: 'found' }),
    })
    expect(fixture.database.select().from(session).all()).toHaveLength(1)
    expect(service.pendingLaunches()).toEqual([])
  } finally {
    fixture.client.close()
  }
})

test('an unknown native ID stays uncertain until unambiguous vendor discovery', async () => {
  const fixture = await harness()
  try {
    const service = fixture.create()
    const intentId = service.beginLaunch(launch)
    service.rememberVendorStart(intentId, null)
    const restarted = fixture.create()
    expect(await restarted.recoverLaunches(async () => ({ kind: 'ambiguous' }))).toEqual([])
    expect(restarted.pendingLaunches().map((intent) => intent.id)).toEqual([intentId])
    expect(fixture.database.select().from(session).all()).toEqual([])
  } finally {
    fixture.client.close()
  }
})

test('only authenticated permanent loss removes a Session and its local Ticket link', async () => {
  const fixture = await harness()
  try {
    const service = fixture.create()
    const argoId = service.reconcile(discovery)
    fixture.client
      .prepare(
        'INSERT INTO session_ticket_link (session_id, project_id, ticket_key, title, state, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(argoId, 'project-1', 'ARGO-1', 'Linked work', 'open', '2026-09-24T00:00:00.000Z')
    for (const kind of ['inaccessible', 'temporarily-unavailable', 'ambiguous', 'found'] as const) {
      expect(await service.reconcileVendorReads(async () => ({ kind }))).toBe(0)
    }
    expect(fixture.database.select().from(session).all()).toHaveLength(1)
    expect(fixture.client.prepare('SELECT * FROM session_ticket_link').all()).toHaveLength(1)
    expect(
      await service.reconcileVendorReads(async () => ({
        kind: 'permanently-unrecoverable',
        authenticated: true,
        harness: 'claude',
        nativeId: 'a-different-session',
      })),
    ).toBe(0)
    expect(fixture.database.select().from(session).all()).toHaveLength(1)
    await recoverSessionState(service, {
      discoverLaunch: async () => ({ kind: 'unavailable' }),
      readKnownSession: async () => ({
        kind: 'permanently-unrecoverable',
        authenticated: true,
        harness: 'claude',
        nativeId: 'native-1',
      }),
    })
    expect(fixture.database.select().from(session).all()).toEqual([])
    expect(fixture.database.select().from(sessionLaunchIntent).all()).toEqual([])
    expect(fixture.database.select().from(managedSessionLease).all()).toEqual([])
    expect(fixture.client.prepare('SELECT * FROM session_ticket_link').all()).toEqual([])
  } finally {
    fixture.client.close()
  }
})

test('a vendor native ID cannot remove another Session Ticket link', async () => {
  const fixture = await harness()
  try {
    const service = fixture.create()
    const retained = service.reconcile({ ...discovery, nativeId: 'other-native' })
    const removed = service.reconcile({ ...discovery, nativeId: retained })
    fixture.client
      .prepare(
        'INSERT INTO session_ticket_link (session_id, project_id, ticket_key, title, state, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(retained, 'project-1', 'ARGO-2', 'Retained work', 'open', '2026-09-24T00:00:00.000Z')
    expect(
      await service.reconcileVendorReads(async (identity) =>
        identity.nativeId === retained
          ? { kind: 'permanently-unrecoverable', authenticated: true, ...identity }
          : { kind: 'found' },
      ),
    ).toBe(1)
    expect(
      fixture.database
        .select()
        .from(session)
        .all()
        .map((row) => row.argoId),
    ).toEqual([retained])
    expect(fixture.client.prepare('SELECT session_id FROM session_ticket_link').all()).toEqual([
      { session_id: retained },
    ])
    expect(removed).not.toBe(retained)
  } finally {
    fixture.client.close()
  }
})

test('unsafe durable storage refuses a launch before a Harness can send', async () => {
  const fixture = await harness()
  try {
    const service = fixture.create()
    fixture.client.exec(
      "CREATE TRIGGER fail_launch_insert BEFORE INSERT ON session_launch_intent BEGIN SELECT RAISE(FAIL, 'storage unsafe'); END",
    )
    expect(() => service.beginLaunch(launch)).toThrow('Failed query')
    expect(service.isUnsafe()).toBe(true)
    expect(fixture.database.select().from(sessionLaunchIntent).all()).toEqual([])
  } finally {
    fixture.client.close()
  }
})

function starterFor(
  fixture: Awaited<ReturnType<typeof harness>>,
  options: {
    execute: (command: unknown) => Promise<unknown>
  },
) {
  const identity = fixture.create()
  const commands: unknown[] = []
  const start = createSessionStarter({
    identity,
    projects: {
      resolveWorkspace: async () => ({ workspaceId: 'workspace-1', cwd: '/tmp/project-1' }),
      projectForWorkspace: () => 'project-1',
    } as never,
    adapters: {
      adapterFor: () => ({
        execute: async (command: unknown) => {
          commands.push(command)
          return options.execute(command)
        },
      }),
    } as never,
  })
  return { identity, start, sends: () => commands.length, commands: () => commands }
}

const command = {
  harness: 'claude' as const,
  prompt: 'Begin.',
  workspace: { kind: 'main' as const },
}
const accepted = {
  kind: 'accepted',
  projection: { session: { harness: 'claude', nativeId: 'native-1' } },
}

test('typed start commits one Argo UUID visible in Roster and detail', async () => {
  const fixture = await harness()
  try {
    fixture.client.exec(
      "INSERT INTO project_selection (singleton, project_id) VALUES (1, 'project-1')",
    )
    const driver = starterFor(fixture, { execute: async () => accepted })
    const caller = appRouter.createCaller({
      database: fixture.database,
      startSession: driver.start,
      selectedProjectId: () => 'project-1',
    })
    const result = await caller.sessions.start(command)
    expect(result.kind).toBe('started')
    if (result.kind !== 'started') throw new Error('Expected a committed Session')
    const roster = await caller.sessions.list({ page: 1, pageSize: 20 })
    expect(roster.items.map((item) => item.argoId)).toEqual([result.argoId])
    expect(await caller.sessions.detail({ argoId: result.argoId })).toMatchObject({
      argoId: result.argoId,
      posture: 'watched',
    })
    expect(driver.sends()).toBe(1)
    expect(driver.commands()[0]).toMatchObject({
      workspace: { kind: 'existing', workspaceId: 'workspace-1' },
    })
  } finally {
    fixture.client.close()
  }
})

test('a committed vendor start with failed SQLite returns uncertain and never replays', async () => {
  const fixture = await harness()
  try {
    const driver = starterFor(fixture, { execute: async () => accepted })
    fixture.client.exec(
      "CREATE TRIGGER fail_session_insert BEFORE INSERT ON session BEGIN SELECT RAISE(FAIL, 'storage failed'); END",
    )
    expect(await driver.start(command)).toEqual({ kind: 'uncertain' })
    expect(driver.sends()).toBe(1)
    fixture.client.exec('DROP TRIGGER fail_session_insert')
    expect(
      await fixture.create().recoverLaunches(async () => {
        throw new Error('The native ID was persisted before commit')
      }),
    ).toHaveLength(1)
    expect(driver.sends()).toBe(1)
  } finally {
    fixture.client.close()
  }
})

test('a vendor outcome without native ID stays uncertain without a second start', async () => {
  const fixture = await harness()
  try {
    const driver = starterFor(fixture, { execute: async () => ({ kind: 'uncertain' }) })
    expect(await driver.start(command)).toEqual({ kind: 'uncertain' })
    expect(await fixture.create().recoverLaunches(async () => ({ kind: 'ambiguous' }))).toEqual([])
    expect(driver.sends()).toBe(1)
  } finally {
    fixture.client.close()
  }
})
