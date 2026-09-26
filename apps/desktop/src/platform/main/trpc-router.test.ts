import { expect, test } from 'bun:test'
import { createActor, fromPromise } from 'xstate'
import type { AccountProcedureContext } from '@/domains/accounts/main/account-procedures'
import type { HarnessSignInProcedureContext } from '@/domains/harness-signin/main/harness-sign-in-procedures'
import type { ProjectRegisterContext } from '@/domains/projects/main/api/project-register'
import { SessionSyncStatusStore } from '@/domains/sessions/main/api/session-sync-status'
import type { LiveSessionSupervisorActor } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import type { TicketRouterDependencies } from '@/domains/tickets/main/ticket-router'
import type { WorkspaceListContext } from '@/domains/workspaces/main/api/workspace-list'
import {
  harnessCatalogMachine,
  harnessCatalogSchema,
} from '@/harnesses/catalog/harness-catalog-machine'
import { claudeHarnessInfo } from '@/harnesses/claude/catalog'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import { claudeModelCatalogFixture } from '../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { codexModelCatalogFixture } from '../../../test-fixtures/sessions/codex-model-catalog.fixture'
import { createAppRouter } from './trpc-router'

type SupervisorEvent = Parameters<LiveSessionSupervisorActor['send']>[0]
const sessions = {
  send: (event: SupervisorEvent) => {
    if (event.type === 'Start' || event.type === 'Send')
      event.reply.resolve({ sessionId: '00000000-0000-4000-8000-000000000001' })
  },
} as LiveSessionSupervisorActor

function testRouter(
  catalog: Parameters<typeof createAppRouter>[0]['catalog'],
  sessionActor = sessions,
) {
  return createAppRouter({
    accounts: {} as AccountProcedureContext,
    catalog,
    harnessSignIn: {} as HarnessSignInProcedureContext,
    projects: {} as ProjectRegisterContext,
    sessions: {
      database: {} as never,
      supervisor: sessionActor,
      refreshSessionSync: () => {},
      sessionSyncStatus: new SessionSyncStatusStore(),
    },
    tickets: {} as TicketRouterDependencies,
    workspaces: {} as WorkspaceListContext,
  })
}

test('returns only the selected Harness as serializable composer choices', async () => {
  const actor = createActor(
    harnessCatalogMachine.provide({
      actors: {
        loadCatalog: fromPromise(async () =>
          harnessCatalogSchema.parse({
            harnesses: [
              claudeHarnessInfo(claudeModelCatalogFixture()),
              codexHarnessInfo(codexModelCatalogFixture()),
            ],
          }),
        ),
      },
    }),
  ).start()
  try {
    const caller = testRouter(actor).createCaller({})
    const claude = await caller.harnessCatalogRead({ harness: 'claude' })
    const codex = await caller.harnessCatalogRead({ harness: 'codex' })
    expect(claude.info.harness).toBe('claude')
    expect(codex.info.harness).toBe('codex')
    expect(claude.info.availability).toBe('available')
    expect(codex.info.availability).toBe('available')
    expect('loading' in codex).toBe(false)
    expect(JSON.parse(JSON.stringify(codex))).toEqual(codex)
  } finally {
    actor.stop()
  }
})

test('accepts a Session sync refresh', async () => {
  let refreshes = 0
  const router = createAppRouter({
    accounts: {} as AccountProcedureContext,
    catalog: {} as never,
    harnessSignIn: {} as HarnessSignInProcedureContext,
    projects: {} as ProjectRegisterContext,
    sessions: {
      database: {} as never,
      supervisor: sessions,
      refreshSessionSync: () => {
        refreshes += 1
      },
      sessionSyncStatus: new SessionSyncStatusStore(),
    },
    tickets: {} as TicketRouterDependencies,
    workspaces: {} as WorkspaceListContext,
  })
  await expect(router.createCaller({}).sessions.refresh()).resolves.toEqual({ accepted: true })
  expect(refreshes).toBe(1)
})

test('repeated reads reuse the settled catalog until an explicit refresh', async () => {
  let loads = 0
  const actor = createActor(
    harnessCatalogMachine.provide({
      actors: {
        loadCatalog: fromPromise(async () => {
          loads += 1
          return harnessCatalogSchema.parse({
            harnesses: [
              claudeHarnessInfo(claudeModelCatalogFixture()),
              codexHarnessInfo(codexModelCatalogFixture()),
            ],
          })
        }),
      },
    }),
  ).start()
  try {
    const caller = testRouter(actor).createCaller({})
    await caller.harnessCatalogRead({ harness: 'claude' })
    await caller.harnessCatalogRead({ harness: 'codex' })
    expect(loads).toBe(1)
    await caller.harnessCatalogRefresh({ harness: 'claude' })
    expect(loads).toBe(2)
    await caller.harnessCatalogRead({ harness: 'claude' })
    expect(loads).toBe(2)
  } finally {
    actor.stop()
  }
})

test('retry reloads a failed catalog once', async () => {
  let loads = 0
  const actor = createActor(
    harnessCatalogMachine.provide({
      actors: {
        loadCatalog: fromPromise(async () => {
          loads += 1
          if (loads === 1) throw new Error('Catalog unavailable')
          return harnessCatalogSchema.parse({
            harnesses: [claudeHarnessInfo(claudeModelCatalogFixture()), codexHarnessInfo(null)],
          })
        }),
      },
    }),
  ).start()
  try {
    const caller = testRouter(actor).createCaller({})
    const failed = await caller.harnessCatalogRead({ harness: 'claude' })
    expect(failed.failure).toContain('Catalog unavailable')
    await caller.harnessCatalogRead({ harness: 'claude' })
    expect(loads).toBe(1)
    const retried = await caller.harnessCatalogRefresh({ harness: 'claude' })
    expect(retried.failure).toBe(null)
    expect(loads).toBe(2)
  } finally {
    actor.stop()
  }
})
