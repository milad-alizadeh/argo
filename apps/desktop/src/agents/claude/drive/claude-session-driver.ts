import type { ClaudePermission } from '@/core/sessions/contract'
import { managedRow } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { ClaudeTurnRequest } from './deliver-turn'
import {
  ClaudeSessionDriverError,
  channelActions,
  type DriverOptions,
  type ManagedSession,
} from './drive-channel'

export type ClaudeSessionDriver = {
  start: (request: { cwd: string } & ClaudeTurnRequest) => string
  send: (sessionId: string, turn: ClaudeTurnRequest) => Promise<void>
  interrupt: (sessionId: string) => void
  roster: () => SessionRosterRow[]
  orphans: () => ReadonlySet<string>
  pendingPermission: (sessionId: string) => ClaudePermission | null
  decidePermission: (sessionId: string, permissionId: string, decision: 'allow' | 'deny') => boolean
  close: () => void
}

const INTERRUPT = '\u001b'

export function createClaudeSessionDriver(options: DriverOptions): ClaudeSessionDriver {
  const sessions = new Map<string, ManagedSession>()
  const channel = channelActions(options, sessions)
  return {
    start(request) {
      const sessionId = options.mintSessionId()
      const session = channel.open({
        sessionId,
        ...request,
        sessionFlags: ['--session-id', sessionId],
      })
      // The Session is reported running now; a failed opening Turn shows as its process ending.
      channel.write(session, request).catch(() => {})
      return sessionId
    },
    async send(sessionId, turn) {
      await channel.write(await channel.channelFor(sessionId, turn), turn)
    },
    interrupt(sessionId) {
      const session = sessions.get(sessionId)
      if (!session) throw new ClaudeSessionDriverError('not-drivable')
      session.process.write(INTERRUPT)
    },
    roster: () =>
      [...sessions.entries()].map(([id, session]) =>
        managedRow(id, { ...session, cli: 'claude', status: 'running', setup: session.applied }),
      ),
    orphans: options.ledger.orphans,
    pendingPermission: () => null,
    decidePermission: () => false,
    close() {
      channel.close()
      for (const [sessionId, session] of sessions) {
        session.process.kill?.()
        session.close()
        options.ledger.release(sessionId)
      }
      sessions.clear()
    },
  }
}
