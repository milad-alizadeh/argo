import {
  type HarnessCatalog,
  harnessCatalogSchema,
  unavailable,
} from './catalog/harness-catalog-machine'
import { createClaudeRegistration } from './claude/registration'
import type { CodexRequest } from './codex/app-server/codex-app-server-client'
import { createCodexRegistration } from './codex/registration'
import type { Harness } from './harness'
import type { HarnessRegistration } from './registration'

export type HarnessRegistry = { [Id in Harness]: HarnessRegistration<Id> }

export function createHarnessRegistry(codexRequest: CodexRequest): HarnessRegistry {
  return {
    claude: createClaudeRegistration(),
    codex: createCodexRegistration(codexRequest),
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
