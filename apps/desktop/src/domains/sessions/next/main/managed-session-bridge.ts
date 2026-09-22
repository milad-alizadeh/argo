import type { BrowserWindow } from 'electron'
import type { SessionCommand } from '@/domains/sessions/next/contract/session-command-contract'
import { managedSessionError } from '@/domains/sessions/next/ipc/managed-session-error'
import { MANAGED_SESSION_OPERATIONS } from '@/domains/sessions/next/ipc/managed-session-operations'
import type { SessionAdapterRegistry } from '@/domains/sessions/next/main/session-adapter-registry'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'

function adapterFor(command: SessionCommand, adapters: SessionAdapterRegistry) {
  const harness = command.type === 'session.start' ? command.harness : command.session.harness
  return adapters.adapterFor(harness)
}

// Managed adapters stay in main. The renderer submits validated product commands and receives
// product projections; it never sees an actor, an SDK channel, or a harness connection.
export function attachManagedSessionBridge(
  window: BrowserWindow,
  options: { adapters: SessionAdapterRegistry; rendererURL: string },
): void {
  registerDomainHandlers({
    window,
    rendererURL: options.rendererURL,
    operations: MANAGED_SESSION_OPERATIONS,
    context: options.adapters,
    handlers: {
      command: async (request, adapters) => {
        const adapter = adapterFor(request.command, adapters)
        if (adapter === undefined) {
          return {
            version: 1,
            type: 'managed-session.outcome',
            requestId: request.requestId,
            outcome: { kind: 'rejected', reason: 'This Session Harness is unavailable.' },
          }
        }
        try {
          return {
            version: 1,
            type: 'managed-session.outcome',
            requestId: request.requestId,
            outcome: await adapter.execute(request.command),
          }
        } catch {
          return {
            version: 1,
            type: 'managed-session.outcome',
            requestId: request.requestId,
            outcome: { kind: 'rejected', reason: 'Argo could not execute this Session command.' },
          }
        }
      },
    },
    error: managedSessionError,
  })
}
