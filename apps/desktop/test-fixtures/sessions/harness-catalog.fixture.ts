import type { AvailableHarness, HarnessInfo } from '@/harnesses/catalog/harness-catalog-machine'
import { type ClaudeModelCatalog, claudeHarnessInfo } from '@/harnesses/claude/catalog'
import { type CodexModelCatalog, codexHarnessInfo } from '@/harnesses/codex/catalog'
import { claudeComposerModelCatalogFixture } from './claude-model-catalog.fixture'
import { codexModelCatalogFixture } from './codex-model-catalog.fixture'

function availableInfo(info: HarnessInfo, harness: 'claude' | 'codex'): AvailableHarness {
  if (info === undefined || info.availability !== 'available')
    throw new Error(`The ${harness} catalog fixture is unavailable.`)
  return info
}

export function claudeHarnessInfoFixture(): AvailableHarness {
  return availableInfo(claudeHarnessInfo(claudeComposerModelCatalogFixture()), 'claude')
}

export function codexHarnessInfoFixture(): AvailableHarness {
  return availableInfo(codexHarnessInfo(codexModelCatalogFixture()), 'codex')
}

export function claudeChoices(catalog: ClaudeModelCatalog | null): AvailableHarness | null {
  const info = claudeHarnessInfo(catalog)
  return info.availability === 'available' ? info : null
}

export function codexChoices(catalog: CodexModelCatalog | null): AvailableHarness | null {
  const info = codexHarnessInfo(catalog)
  return info.availability === 'available' ? info : null
}
