import type { ClaudeModelCatalog } from '@/domains/sessions/contract/claude-model-catalog'
import type { CodexModelCatalog } from '@/domains/sessions/contract/codex-model-catalog'
import type { SessionCommand } from '@/domains/sessions/next/contract/session-command-contract'
import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'
import type {
  SessionCommandOutcome,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import { managedSessionProjectionEventSchema } from '@/domains/sessions/next/ipc/managed-session-contract'
import { managedSessionError } from '@/domains/sessions/next/ipc/managed-session-error'
import { MANAGED_SESSION_OPERATIONS } from '@/domains/sessions/next/ipc/managed-session-operations'
import { createDomainClient } from '@/shared/ipc/client'

export type ManagedSessionClient = {
  readCodexModelCatalog: () => Promise<CodexModelCatalog | null>
  readClaudeModelCatalog: () => Promise<ClaudeModelCatalog | null>
  executeManagedSessionCommand: (command: SessionCommand) => Promise<SessionCommandOutcome>
  subscribeManagedSession: (
    session: SessionIdentity,
    listener: (projection: SessionProjection) => void,
  ) => Promise<() => void>
}

export function createManagedSessionClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
  subscribe: (channel: string, listener: (value: unknown) => void) => () => void = () => () => {},
): ManagedSessionClient {
  const client = createDomainClient(MANAGED_SESSION_OPERATIONS, invoke, managedSessionError)
  return {
    async readCodexModelCatalog() {
      const reply = await client.catalog({})
      return reply.type === 'managed-session.catalog.result' ? reply.catalog : null
    },
    async readClaudeModelCatalog() {
      const reply = await client.claudeCatalog({})
      return reply.type === 'managed-session.claude-catalog.result' ? reply.catalog : null
    },
    async executeManagedSessionCommand(command) {
      const reply = await client.command({ command })
      switch (reply.type) {
        case 'managed-session.outcome':
          return reply.outcome
        case 'managed-session.error':
          return { kind: 'uncertain' }
      }
    },
    async subscribeManagedSession(session, listener) {
      const reply = await client.subscribe({ session })
      if (reply.type !== 'managed-session.subscribed') return () => {}
      return subscribe('argo:managed-session:projection', (value) => {
        const parsed = managedSessionProjectionEventSchema.safeParse(value)
        if (
          parsed.success &&
          parsed.data.projection.session.harness === session.harness &&
          parsed.data.projection.session.nativeId === session.nativeId
        ) {
          listener(parsed.data.projection)
        }
      })
    },
  }
}
