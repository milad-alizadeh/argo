import { fromCallback } from 'xstate'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import { indexSessionIngestion } from './index-discovered-sessions'

type SessionIndexInput = { database: DurableDatabase }
type SessionIndexEvent = { type: 'Index'; sessions: SessionIngestion[] }

export const sessionIndexActor = fromCallback<SessionIndexEvent, SessionIndexInput>(
  ({ input, receive }) => {
    receive((event) => {
      for (const session of event.sessions) indexSessionIngestion(input.database, session)
    })
  },
)
