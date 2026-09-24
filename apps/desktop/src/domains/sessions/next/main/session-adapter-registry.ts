import type { ClaudeModelCatalog } from '@/domains/sessions/contract/claude-model-catalog'
import type { CodexModelCatalog } from '@/domains/sessions/contract/codex-model-catalog'
import type { SessionService } from '@/domains/sessions/main/lifecycle/session-service'
import type {
  LaunchDiscovery,
  PendingSessionLaunch,
  VendorSessionRead,
} from '@/domains/sessions/main/session-identity-service'
import type {
  Harness,
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type { SessionAdapter } from '@/domains/sessions/next/contract/session-projection-contract'

export type SessionAdapterRuntime = {
  sessionService: SessionService
  waitForWorkspaceReady: (workspaceId: string) => Promise<void>
  now: () => Date
  resolveWorkspace: (selection: WorkspaceSelection) => Promise<{ workspaceId: string; cwd: string }>
  knownWorkspaces: () => Promise<readonly { id: string; path: string }[]>
}

export type SessionAdapterInstance = {
  adapter: SessionAdapter
  close: () => void | Promise<void>
  discoverLaunch?: (intent: PendingSessionLaunch) => Promise<LaunchDiscovery>
  readKnownSession?: (session: SessionIdentity) => Promise<VendorSessionRead>
  hasLiveChannel?: (session: SessionIdentity) => boolean
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
  discoverLaunch: (intent: PendingSessionLaunch) => Promise<LaunchDiscovery>
  readKnownSession: (session: SessionIdentity) => Promise<VendorSessionRead>
  hasLiveChannel: (session: SessionIdentity) => boolean
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
    hasLiveChannel: (session) => adapters.get(session.harness)?.hasLiveChannel?.(session) ?? false,
    readKnownSession: (session) =>
      adapters.get(session.harness)?.readKnownSession?.(session) ??
      Promise.resolve({ kind: 'inaccessible' }),
    discoverLaunch: (intent) =>
      adapters.get(intent.harness)?.discoverLaunch?.(intent) ??
      Promise.resolve({ kind: 'unavailable' }),
    close: async () => {
      await Promise.all([...adapters.values()].map((instance) => instance.close()))
    },
  }
}
