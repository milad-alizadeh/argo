import { expect, test } from 'bun:test'
import { createActor, fromPromise } from 'xstate'
import type { LiveSessionSupervisorActor } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import { ACP_HARNESSES } from '@/harnesses/acp/acp-agents'
import { claudeHarnessInfo } from '@/harnesses/claude/catalog'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import { harnessCatalogSchema, unavailable } from '@/harnesses/harness-catalog'
import { codexModelCatalogFixture } from '@/mocks/recordings/codex-model-catalog'
import { claudeModelCatalogFixture } from '@/mocks/sessions/claude-model-catalog.fixture'
import { sessionRouterDependencies } from '@/mocks/sessions/session-router-dependencies.fixture'
import { harnessCatalogMachine } from './harness-catalog/harness-catalog-machine'
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
  refreshSessionSync = () => {},
) {
  return createAppRouter({
    ...sessionRouterDependencies({} as never, {
      supervisor: sessionActor,
      refreshSessionSync,
      createOwnedWorktree: async () => ({
        path: '/tmp/argo-test-worktrees',
        branch: 'argo/session-test',
      }),
      acceptsAttachments: () => true,
      chooseAttachmentFiles: async () => [],
    }),
    autoCompactLimit: () => undefined,
    catalog,
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
              ...ACP_HARNESSES.map((harness) => unavailable(harness)),
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
  const router = testRouter({} as never, sessions, () => {
    refreshes += 1
  })
  await expect(router.createCaller({}).sessionRefresh()).resolves.toEqual({ accepted: true })
  expect(refreshes).toBe(1)
})

test('registers Session procedures directly on the global router', () => {
  const paths = Object.keys(testRouter({} as never)._def.procedures)
  for (const path of [
    'sessionList',
    'sessionListChanged',
    'sessionFeed',
    'sessionFeedRefresh',
    'sessionUpdate',
    'sessionRefresh',
    'sessionSyncStatus',
  ])
    expect(paths).toContain(path)
  expect(paths.some((path) => path === 'sessions' || path.startsWith('sessions.'))).toBe(false)
})

test('registers Ticket procedures directly on the global router', () => {
  const paths = Object.keys(testRouter({} as never)._def.procedures)
  for (const path of [
    'ticketConnection',
    'ticketActive',
    'ticketDetail',
    'ticketOpen',
    'ticketSync',
    'ticketWatch',
    'ticketChanges',
  ])
    expect(paths).toContain(path)
  expect(paths).not.toContain('ticketList')
  expect(paths.some((path) => path === 'tickets' || path.startsWith('tickets.'))).toBe(false)
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
              ...ACP_HARNESSES.map((harness) => unavailable(harness)),
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
            harnesses: [
              claudeHarnessInfo(claudeModelCatalogFixture()),
              codexHarnessInfo(null),
              ...ACP_HARNESSES.map((harness) => unavailable(harness)),
            ],
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
