import { expect, test } from 'bun:test'
import { createActor, fromPromise } from 'xstate'
import type { ProjectStore } from '@/domains/projects/main/register-project'
import type { SessionSubmitInput } from '@/domains/sessions/main/api/session-start'
import type { LiveSessionSupervisorActor } from '@/domains/sessions/main/live/live-session-supervisor-machine'
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
const projects = { read: () => ({ projects: [] }) } as unknown as ProjectStore

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
    const caller = createAppRouter(actor, sessions, projects).createCaller({})
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
    const caller = createAppRouter(actor, sessions, projects).createCaller({})
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
    const caller = createAppRouter(actor, sessions, projects).createCaller({})
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

test('routes a second optimistic composer command to the same pending Session', async () => {
  const submitted: Array<{ pendingId: string; prompt: string }> = []
  const supervisor = {
    send: (event: SupervisorEvent) => {
      if (event.type === 'Start') {
        submitted.push({ pendingId: event.pendingId, prompt: event.input.prompt })
        event.reply.resolve({ sessionId: '00000000-0000-4000-8000-000000000001' })
      }
    },
  } as LiveSessionSupervisorActor
  const actor = createActor(
    harnessCatalogMachine.provide({
      actors: {
        loadCatalog: fromPromise(async () => harnessCatalogSchema.parse({ harnesses: [] })),
      },
    }),
  ).start()
  try {
    const caller = createAppRouter(actor, supervisor, projects).createCaller({})
    const initial: SessionSubmitInput = {
      commandId: '00000000-0000-4000-8000-000000000002',
      harness: 'claude',
      projectId: '00000000-0000-4000-8000-000000000099',
      cwd: '/repo',
      sessionId: null,
      pendingId: 'optimistic:session-1',
      prompt: 'Start a Session.',
      attachments: [],
      setup: { model: 'claude-sonnet', effort: 'medium', mode: 'default' },
    }
    await Promise.all([
      caller.sessionSubmit(initial),
      caller.sessionSubmit({
        ...initial,
        commandId: '00000000-0000-4000-8000-000000000003',
        prompt: 'Continue the plan.',
      }),
    ])
    expect(submitted).toEqual([
      { pendingId: 'optimistic:session-1', prompt: 'Start a Session.' },
      { pendingId: 'optimistic:session-1', prompt: 'Continue the plan.' },
    ])
  } finally {
    actor.stop()
  }
})

test('rejects Claude attachments before a Session reaches a vendor', async () => {
  let submissions = 0
  const supervisor = {
    send: (event: SupervisorEvent) => {
      if (event.type === 'Start' || event.type === 'Send') {
        submissions += 1
        event.reply.resolve({ sessionId: '00000000-0000-4000-8000-000000000001' })
      }
    },
  } as LiveSessionSupervisorActor
  const actor = createActor(
    harnessCatalogMachine.provide({
      actors: {
        loadCatalog: fromPromise(async () => harnessCatalogSchema.parse({ harnesses: [] })),
      },
    }),
  ).start()
  try {
    const caller = createAppRouter(actor, supervisor, projects).createCaller({})
    await expect(
      caller.sessionSubmit({
        commandId: '00000000-0000-4000-8000-000000000002',
        harness: 'claude',
        projectId: '00000000-0000-4000-8000-000000000099',
        cwd: '/repo',
        sessionId: null,
        pendingId: 'optimistic:session-1',
        prompt: 'Read this image.',
        attachments: [{ kind: 'image', path: '/repo/image.png' }],
        setup: { model: 'claude-sonnet', effort: 'medium', mode: 'default' },
      }),
    ).rejects.toThrow('Claude Session attachments are not supported.')
    expect(submissions).toBe(0)
  } finally {
    actor.stop()
  }
})
