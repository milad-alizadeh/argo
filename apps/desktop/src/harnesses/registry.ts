import {
  type HarnessCatalog,
  harnessCatalogSchema,
  unavailable,
} from './catalog/harness-catalog-machine'
import { createClaudeRegistration } from './claude/registration'
import { createCodexRegistration } from './codex/registration'
import type { CodexLiveClient } from './codex/session/codex-session-channel'
import type { Harness } from './harness'
import type { HarnessRegistration } from './registration'

export type HarnessRegistry = { [Id in Harness]: HarnessRegistration<Id> }

export function createHarnessRegistry(codexClient: CodexLiveClient): HarnessRegistry {
  return {
    claude: createClaudeRegistration(),
    codex: createCodexRegistration(codexClient),
  }
}

export async function readHarnessCatalog(registry: HarnessRegistry): Promise<HarnessCatalog> {
  const harnesses = await Promise.all(
    Object.values(registry).map(async (registration) => {
      try {
        return await registration.readCatalog()
      } catch {
        return unavailable(registration.harness)
      }
    }),
  )
  return harnessCatalogSchema.parse({ harnesses })
}
