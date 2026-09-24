import type { ClaudeModelCatalog } from '@/domains/sessions/contract/claude-model-catalog'
import type { CodexModelCatalog } from '@/domains/sessions/contract/codex-model-catalog'
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
  readModelCatalog?: () => Promise<CodexModelCatalog | null>
  readClaudeModelCatalog?: () => Promise<ClaudeModelCatalog | null>
}

export type SessionAdapterRegistration = {
  harness: Harness
  create: (runtime: SessionAdapterRuntime) => SessionAdapterInstance
}

export type SessionAdapterRegistry = {
  adapterFor: (harness: Harness) => SessionAdapter | undefined
  readModelCatalog: (harness: Harness) => Promise<CodexModelCatalog | null>
  readClaudeModelCatalog: () => Promise<ClaudeModelCatalog | null>
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
    readModelCatalog: (harness) =>
      adapters.get(harness)?.readModelCatalog?.() ?? Promise.resolve(null),
    readClaudeModelCatalog: () =>
      adapters.get('claude')?.readClaudeModelCatalog?.() ?? Promise.resolve(null),
    close: async () => {
      await Promise.all([...adapters.values()].map((instance) => instance.close()))
    },
  }
}
