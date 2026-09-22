// Shared mocks for use-session-ticket-link.test.ts: a mock window.argo and a Session builder,
// so each test states only the title source and Turn status it cares about.

import { sessionRosterRow } from '@/domains/sessions/renderer/session-fixtures'
import type { Session } from '@/domains/sessions/renderer/types'
import type { ConnectTicketInput } from './use-session-ticket-link'

type TitleSource = NonNullable<Session['title']>['source']

export const TICKET: ConnectTicketInput = {
  projectId: 'project-1',
  key: 'ARGO-1',
  title: 'Fix the roster badge',
  state: 'open',
}

export function session(source: TitleSource, status: 'idle' | 'running' = 'idle') {
  const text = source === 'custom' ? 'My own title' : 'Open the rename proof.'
  return sessionRosterRow({
    id: 'session-1',
    cwd: '/argo',
    posture: 'managed',
    status,
    title: { text, source },
  })
}

export function mockArgo(
  overrides: { connectSessionTicket?: unknown; renameSession?: unknown } = {},
) {
  const calls: { connectSessionTicket: unknown[]; renameSession: unknown[] } = {
    connectSessionTicket: [],
    renameSession: [],
  }
  return {
    calls,
    connectSessionTicket: async (request: unknown) => {
      calls.connectSessionTicket.push(request)
      return (
        overrides.connectSessionTicket ?? {
          type: 'session.accepted',
          version: 1,
          requestId: 'r1',
          sessionId: 'session-1',
        }
      )
    },
    renameSession: async (request: unknown) => {
      calls.renameSession.push(request)
      return (
        overrides.renameSession ?? {
          type: 'session.renamed',
          version: 1,
          requestId: 'r2',
          sessionId: 'session-1',
          title: TICKET.title,
        }
      )
    },
    disconnectSessionTicket: async () => ({
      type: 'session.accepted',
      version: 1,
      requestId: 'r3',
      sessionId: 'session-1',
    }),
  }
}
