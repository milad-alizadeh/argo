import { expect, test } from 'bun:test'
import { createActor } from 'xstate'
import {
  createHarnessCatalogMachine,
  harnessCatalogSchema,
} from '@/harnesses/catalog/harness-catalog-machine'
import { claudeHarnessInfo } from '@/harnesses/claude/catalog'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import { claudeModelCatalogFixture } from '../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { codexModelCatalogFixture } from '../../../test-fixtures/sessions/codex-model-catalog.fixture'
import { createAppRouter } from './trpc-router'

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
    const caller = createAppRouter(actor).createCaller({})
    const claude = await caller.harnessCatalogSnapshot({ harness: 'claude' })
    const codex = await caller.harnessCatalogSnapshot({ harness: 'codex' })
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
    const caller = createAppRouter(actor).createCaller({})
    await caller.harnessCatalogSnapshot({ harness: 'claude' })
    await caller.harnessCatalogSnapshot({ harness: 'codex' })
    expect(loads).toBe(1)
    await caller.harnessCatalogRefresh({ harness: 'claude' })
    expect(loads).toBe(2)
    await caller.harnessCatalogSnapshot({ harness: 'claude' })
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
    const caller = createAppRouter(actor).createCaller({})
    const failed = await caller.harnessCatalogSnapshot({ harness: 'claude' })
    expect(failed.failure).toContain('Catalog unavailable')
    await caller.harnessCatalogSnapshot({ harness: 'claude' })
    expect(loads).toBe(1)
    const retried = await caller.harnessCatalogRefresh({ harness: 'claude' })
    expect(retried.failure).toBe(null)
    expect(loads).toBe(2)
  } finally {
    actor.stop()
  }
})
