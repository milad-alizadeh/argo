import { fromCallback } from 'xstate'
import type { DiscoveredSession } from '@/domains/sessions/contract/session-index'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { indexDiscoveredSession } from './index-discovered-sessions'

type SessionIndexInput = { database: DurableDatabase }
type SessionIndexEvent = { type: 'Index'; sessions: DiscoveredSession[] }

export const sessionIndexActor = fromCallback<SessionIndexEvent, SessionIndexInput>(
  ({ input, receive }) => {
    receive((event) => {
      for (const session of event.sessions) indexDiscoveredSession(input.database, session)
    })
  },
)
