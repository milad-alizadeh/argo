import type { AvailableHarness, HarnessInfo } from '@/harnesses/catalog/harness-catalog-machine'
import { type ClaudeModelCatalog, claudeHarnessInfo } from '@/harnesses/claude/catalog'
import { type CodexModelCatalog, codexHarnessInfo } from '@/harnesses/codex/catalog'
import { claudeComposerModelCatalogFixture } from './claude-model-catalog.fixture'
import { codexModelCatalogFixture } from './codex-model-catalog.fixture'

function availableInfo(info: HarnessInfo, harness: 'claude' | 'codex'): HarnessInfo {
  if (info === undefined || info.availability !== 'available')
    throw new Error(`The ${harness} catalog fixture is unavailable.`)
  return info
}

export function claudeHarnessInfoFixture(): Extract<HarnessInfo, { harness: 'claude' }> {
  return availableInfo(claudeHarnessInfo(claudeComposerModelCatalogFixture()), 'claude') as Extract<
    HarnessInfo,
    { harness: 'claude' }
  >
}

export function codexHarnessInfoFixture(): Extract<HarnessInfo, { harness: 'codex' }> {
  return availableInfo(codexHarnessInfo(codexModelCatalogFixture()), 'codex') as Extract<
    HarnessInfo,
    { harness: 'codex' }
  >
}

export function claudeChoices(catalog: ClaudeModelCatalog | null): AvailableHarness | null {
  const info = claudeHarnessInfo(catalog)
  return info.availability === 'available' ? info : null
}

export function codexChoices(catalog: CodexModelCatalog | null): AvailableHarness | null {
  const info = codexHarnessInfo(catalog)
  return info.availability === 'available' ? info : null
}
