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
