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
  close: () => void
  source?: SessionSource
}

export type SessionAdapterRegistration = {
  harness: Harness
  create: (runtime: SessionAdapterRuntime) => SessionAdapterInstance
}

export type SessionAdapterRegistry = {
  adapterFor: (harness: Harness) => SessionAdapter | undefined
  sourceFor: (harness: Harness) => SessionSource | undefined
  close: () => void
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
    close: () => {
      for (const instance of adapters.values()) instance.close()
    },
  }
}
