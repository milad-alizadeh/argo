import { createClaudeRegistration } from './claude/registration'
import { createClaudeAcpRegistration } from './claude-acp/registration'
import {
  type CodexAppServerClient,
  createCodexAppServerClient,
} from './codex/app-server/codex-app-server-client'
import { createCodexRegistration } from './codex/registration'
import type { Harness } from './harness'
import { type HarnessCatalog, harnessCatalogSchema, unavailable } from './harness-catalog'
import type { HarnessRegistration } from './registration'

export type HarnessRegistry = { [Id in Harness]: HarnessRegistration<Id> }

export function createHarnessRegistry(
  codexClient: CodexAppServerClient = createCodexAppServerClient(),
): HarnessRegistry {
  return {
    claude: createClaudeRegistration(),
    codex: createCodexRegistration(codexClient),
    'claude-acp': createClaudeAcpRegistration(),
  }
}

export function shutdownHarnessRegistry(registry: HarnessRegistry): void {
  for (const registration of Object.values(registry)) registration.shutdown?.()
}

export async function readHarnessCatalog(registry: HarnessRegistry): Promise<HarnessCatalog> {
  const harnesses = await Promise.all(
    Object.values(registry).map(async (registration) => {
      try {
        return await registration.readCatalog()
      } catch (error) {
        console.warn(`The ${registration.harness} catalog read failed:`, error)
        return unavailable(registration.harness)
      }
    }),
  )
  return harnessCatalogSchema.parse({ harnesses })
}
