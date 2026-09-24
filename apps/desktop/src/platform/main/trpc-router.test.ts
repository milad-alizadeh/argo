import { expect, test } from 'bun:test'
import { createActor } from 'xstate'
import type { SessionRuntime } from '@/domains/sessions/main/live/session-runtime'
import {
  createHarnessCatalogMachine,
  harnessCatalogSchema,
} from '@/harnesses/catalog/harness-catalog-machine'
import { claudeHarnessInfo } from '@/harnesses/claude/catalog'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import { claudeModelCatalogFixture } from '../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { codexModelCatalogFixture } from '../../../test-fixtures/sessions/codex-model-catalog.fixture'
import { createAppRouter } from './trpc-router'

const sessions = {
  start: async () => ({ sessionId: '00000000-0000-4000-8000-000000000001' }),
  send: async () => ({ sessionId: '00000000-0000-4000-8000-000000000001' }),
  submit: async () => ({ sessionId: '00000000-0000-4000-8000-000000000001' }),
  stop: () => {},
} as SessionRuntime

test('returns only the selected Harness as serializable composer choices', async () => {
  const actor = createActor(
    createHarnessCatalogMachine(async () =>
      harnessCatalogSchema.parse({
        harnesses: [
          claudeHarnessInfo(claudeModelCatalogFixture()),
          codexHarnessInfo(codexModelCatalogFixture()),
        ],
      }),
    ),
  ).start()
  try {
    const caller = createAppRouter(actor, sessions).createCaller({})
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
    createHarnessCatalogMachine(async () => {
      loads += 1
      return harnessCatalogSchema.parse({
        harnesses: [
          claudeHarnessInfo(claudeModelCatalogFixture()),
          codexHarnessInfo(codexModelCatalogFixture()),
        ],
      })
    }),
  ).start()
  try {
    const caller = createAppRouter(actor, sessions).createCaller({})
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
    createHarnessCatalogMachine(async () => {
      loads += 1
      if (loads === 1) throw new Error('Catalog unavailable')
      return harnessCatalogSchema.parse({
        harnesses: [claudeHarnessInfo(claudeModelCatalogFixture()), codexHarnessInfo(null)],
      })
    }),
  ).start()
  try {
    const caller = createAppRouter(actor, sessions).createCaller({})
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

test('routes composer commands through the single Session submission mutation', async () => {
  const submitted: Array<{ sessionId: string | null; prompt: string }> = []
  const runtime = {
    ...sessions,
    submit: async (input: { sessionId: string | null; prompt: string }) => {
      submitted.push(input)
      return { sessionId: '00000000-0000-4000-8000-000000000001' }
    },
  } as SessionRuntime
  const actor = createActor(
    createHarnessCatalogMachine(async () => harnessCatalogSchema.parse({ harnesses: [] })),
  ).start()
  try {
    const caller = createAppRouter(actor, runtime).createCaller({})
    await caller.sessionSubmit({
      commandId: '00000000-0000-4000-8000-000000000002',
      harness: 'claude',
      cwd: '/repo',
      sessionId: null,
      prompt: 'Start a Session.',
      attachments: [],
      setup: { model: 'claude-sonnet', effort: 'medium', mode: 'default' },
    })
    expect(submitted).toHaveLength(1)
    expect(submitted[0]).toMatchObject({ sessionId: null, prompt: 'Start a Session.' })
  } finally {
    actor.stop()
  }
})
