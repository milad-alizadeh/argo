import type { SessionCommand } from '@/domains/sessions/next/contract/session-command-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import { managedSessionError } from '@/domains/sessions/next/ipc/managed-session-error'
import { MANAGED_SESSION_OPERATIONS } from '@/domains/sessions/next/ipc/managed-session-operations'
import { createDomainClient } from '@/shared/ipc/client'

export type ManagedSessionClient = {
  executeManagedSessionCommand: (command: SessionCommand) => Promise<SessionCommandOutcome>
}

export function createManagedSessionClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): ManagedSessionClient {
  const client = createDomainClient(MANAGED_SESSION_OPERATIONS, invoke, managedSessionError)
  return {
    async executeManagedSessionCommand(command) {
      const reply = await client.command({ command })
      switch (reply.type) {
        case 'managed-session.outcome':
          return reply.outcome
        case 'managed-session.error':
          return { kind: 'uncertain' }
      }
    },
  }
}
