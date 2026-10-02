import type { Database } from '@/database/database'
import { SessionListChanges } from '@/domains/sessions/main/api/session-list-changes'
import {
  type SessionFeedReaderContext,
  SessionFeedReaders,
} from '@/domains/sessions/main/feed/feed-reader'
import { SessionEventJournal } from '@/domains/sessions/main/live/session-event-journal'
import type { AppRouterDependencies } from '@/platform/main/trpc-router'

type SessionDependencies = AppRouterDependencies['sessions'] & SessionFeedReaderContext

// Router dependencies with only the Session part filled in; `sessions` overrides the defaults,
// including what the shared Feed readers read.
export function sessionRouterDependencies(
  database: Database,
  sessions: Partial<SessionDependencies> = {},
): AppRouterDependencies {
  const context = {
    database,
    journal: new SessionEventJournal(),
    hasLiveChannel: () => false,
    readHistory: async () => ({ content: [], complete: true }),
    changes: new SessionListChanges(),
    ticketSource: async () => null,
    supervisor: {
      getSnapshot: () => ({ context: { sessions: {} } }),
      send: () => {},
      on: () => ({ unsubscribe: () => {} }),
    },
    ...sessions,
  } as unknown as SessionDependencies
  return {
    accounts: {},
    catalog: {},
    harnessSignIn: {},
    projects: { database },
    sessions: { ...context, readers: sessions.readers ?? new SessionFeedReaders(context) },
    tickets: {},
  } as unknown as AppRouterDependencies
}
