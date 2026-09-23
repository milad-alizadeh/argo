import type { BrowserWindow } from 'electron'
import type { SessionCommand } from '@/domains/sessions/next/contract/session-command-contract'
import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import type {
  ManagedSessionOutcome,
  ManagedSessionSubscribed,
} from '@/domains/sessions/next/ipc/managed-session-contract'
import { managedSessionError } from '@/domains/sessions/next/ipc/managed-session-error'
import { MANAGED_SESSION_OPERATIONS } from '@/domains/sessions/next/ipc/managed-session-operations'
import type { SessionAdapterRegistry } from '@/domains/sessions/next/main/session-adapter-registry'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'

function adapterFor(command: SessionCommand, adapters: SessionAdapterRegistry) {
  const harness = command.type === 'session.start' ? command.harness : command.session.harness
  return adapters.adapterFor(harness)
}

function sessionKey(session: SessionIdentity): string {
  return `${session.harness}:${session.nativeId}`
}

function outcomeReply(requestId: string, outcome: SessionCommandOutcome): ManagedSessionOutcome {
  return { version: 1, type: 'managed-session.outcome', requestId, outcome }
}

function subscribedReply(requestId: string): ManagedSessionSubscribed {
  return { version: 1, type: 'managed-session.subscribed', requestId }
}

// Managed adapters stay in main. The renderer submits validated product commands and receives
// product projections; it never sees an actor, an SDK channel, or a harness connection.
export function attachManagedSessionBridge(
  window: BrowserWindow,
  options: { adapters: SessionAdapterRegistry; rendererURL: string },
): void {
  const subscriptions = new Map<string, () => void>()
  registerDomainHandlers({
    window,
    rendererURL: options.rendererURL,
    operations: MANAGED_SESSION_OPERATIONS,
    context: options.adapters,
    handlers: {
      command: async (request, adapters) => {
        const adapter = adapterFor(request.command, adapters)
        if (adapter === undefined) {
          return outcomeReply(request.requestId, {
            kind: 'rejected',
            reason: 'This Session Harness is unavailable.',
          })
        }
        try {
          return outcomeReply(request.requestId, await adapter.execute(request.command))
        } catch {
          return outcomeReply(request.requestId, {
            kind: 'rejected',
            reason: 'Argo could not execute this Session command.',
          })
        }
      },
      subscribe: (request, adapters) => {
        const adapter = adapters.adapterFor(request.session.harness)
        if (adapter === undefined) return managedSessionError('invalid-request', request.requestId)
        const key = sessionKey(request.session)
        subscriptions.get(key)?.()
        subscriptions.set(
          key,
          adapter.subscribe(request.session, (projection) => {
            window.webContents.send('argo:managed-session:projection', {
              version: 1,
              type: 'managed-session.projection',
              requestId: 'subscription',
              projection,
            })
          }),
        )
        return subscribedReply(request.requestId)
      },
      catalog: async (request, adapters) => ({
        version: 1 as const,
        type: 'managed-session.catalog.result' as const,
        requestId: request.requestId,
        catalog: await adapters.readModelCatalog('codex'),
      }),
    },
    error: managedSessionError,
  })
}
