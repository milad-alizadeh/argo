import { type CodexModelCatalog, readModelCatalog } from '@/harnesses/codex/catalog'
import { recordedCodexModels } from './codex-app-server'

export function codexModelCatalogFixture(): CodexModelCatalog {
  return readModelCatalog(structuredClone(recordedCodexModels))
}
