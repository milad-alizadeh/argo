import { expect, test } from 'bun:test'
import { claudeHarnessInfo } from '@/harnesses/claude/catalog'
import { codexHarnessInfo } from '@/harnesses/codex/catalog'
import type { HarnessRegistry } from '@/harnesses/registry'
import { claudeModelCatalogFixture } from '../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { codexModelCatalogFixture } from '../../../test-fixtures/sessions/codex-model-catalog.fixture'
import { createHarnessCatalogLoad } from './runtime'

test('keeps one Harness available when another registration catalog read fails', async () => {
  const registrations = {
    claude: {
      readCatalog: async () => claudeHarnessInfo(claudeModelCatalogFixture()),
    },
    codex: {
      readCatalog: async () => {
        throw new Error('Codex catalog is unavailable')
      },
    },
  } as unknown as HarnessRegistry

  const catalog = await createHarnessCatalogLoad(registrations)()

  expect(catalog.harnesses[0]?.availability).toBe('available')
  expect(catalog.harnesses[1]).toEqual(codexHarnessInfo(null))
})

test('reads both catalogs through the compiled-in registrations', async () => {
  const read = {
    claude: 0,
    codex: 0,
  }
  const registrations = {
    claude: {
      readCatalog: async () => {
        read.claude += 1
        return claudeHarnessInfo(claudeModelCatalogFixture())
      },
    },
    codex: {
      readCatalog: async () => {
        read.codex += 1
        return codexHarnessInfo(codexModelCatalogFixture())
      },
    },
  } as unknown as HarnessRegistry

  const catalog = await createHarnessCatalogLoad(registrations)()

  expect(read).toEqual({ claude: 1, codex: 1 })
  expect(catalog.harnesses.map(({ availability }) => availability)).toEqual([
    'available',
    'available',
  ])
})
