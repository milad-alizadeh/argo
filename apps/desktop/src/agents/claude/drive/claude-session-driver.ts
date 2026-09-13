import type { ClaudePermission } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import {
  ClaudeSessionDriverError,
  channelActions,
  type DriverOptions,
  type ManagedSession,
} from './drive-channel'
import { managedRow } from './managed-row'

export type ClaudeSessionDriver = {
  start: (request: { cwd: string; prompt: string }) => string
  send: (sessionId: string, text: string) => Promise<void>
  interrupt: (sessionId: string) => void
  roster: () => SessionRosterRow[]
  ownedBefore: (sessionId: string) => boolean
  pendingPermission: (sessionId: string) => ClaudePermission | null
  decidePermission: (sessionId: string, permissionId: string, decision: 'allow' | 'deny') => boolean
  close: () => void
}

export const SUBMIT_DELAY_MS = 150
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
        chain: ['--session-id', sessionId],
      })
      channel.write(session, request.prompt)
      return sessionId
    },
    async send(sessionId, text) {
      channel.write(await channel.find(sessionId, text), text)
    },
    interrupt(sessionId) {
      const session = sessions.get(sessionId)
      if (!session) throw new ClaudeSessionDriverError('not-drivable')
      session.process.write(INTERRUPT)
    },
    roster: () => [...sessions.entries()].map(([id, session]) => managedRow(id, session)),
    ownedBefore: (sessionId) => options.ledger.standing(sessionId) !== 'never-owned',
    pendingPermission: () => null,
    decidePermission: () => false,
    close() {
      for (const [sessionId, session] of sessions) {
        session.process.kill?.()
        session.close()
        options.ledger.release(sessionId)
      }
      sessions.clear()
    },
  }
}
