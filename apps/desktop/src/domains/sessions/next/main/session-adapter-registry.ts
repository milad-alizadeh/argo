import type { CodexModelCatalog } from '@/domains/sessions/contract/codex-model-catalog'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import type { Harness, WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'
import type { SessionAdapter } from '@/domains/sessions/next/contract/session-projection-contract'
import type { SessionService } from '@/domains/sessions/next/main/session-service'

export type SessionAdapterRuntime = {
  sessionService: SessionService
  waitForWorkspaceReady: (workspaceId: string) => Promise<void>
  now: () => Date
  resolveWorkspace: (selection: WorkspaceSelection) => Promise<{ workspaceId: string; cwd: string }>
}

export type SessionAdapterInstance = {
  adapter: SessionAdapter
  close: () => void | Promise<void>
  source?: SessionSource
  readModelCatalog?: () => Promise<CodexModelCatalog | null>
}

export type SessionAdapterRegistration = {
  harness: Harness
  create: (runtime: SessionAdapterRuntime) => SessionAdapterInstance
}

export type SessionAdapterRegistry = {
  adapterFor: (harness: Harness) => SessionAdapter | undefined
  sourceFor: (harness: Harness) => SessionSource | undefined
  readModelCatalog: (harness: Harness) => Promise<CodexModelCatalog | null>
  close: () => Promise<void>
}

export function createSessionAdapterRegistry(
  runtime: SessionAdapterRuntime,
  registrations: readonly SessionAdapterRegistration[],
): SessionAdapterRegistry {
  const adapters = new Map<Harness, SessionAdapterInstance>()
  for (const registration of registrations) {
    if (adapters.has(registration.harness)) {
      throw new Error(`Session adapter already registered for ${registration.harness}`)
    }
    adapters.set(registration.harness, registration.create(runtime))
  }
  return {
    adapterFor: (harness) => adapters.get(harness)?.adapter,
    sourceFor: (harness) => adapters.get(harness)?.source,
    readModelCatalog: (harness) =>
      adapters.get(harness)?.readModelCatalog?.() ?? Promise.resolve(null),
    close: async () => {
      await Promise.all([...adapters.values()].map((instance) => instance.close()))
    },
  }
}
