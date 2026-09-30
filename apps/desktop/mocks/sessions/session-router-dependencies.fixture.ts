import type { Database } from '@/database/database'
import { SessionRosterChanges } from '@/domains/sessions/main/api/session-roster-changes'
import { SessionEventJournal } from '@/domains/sessions/main/live/session-event-journal'
import type { AppRouterDependencies } from '@/platform/main/trpc-router'

// Router dependencies with only the Session part filled in; `sessions` overrides the defaults.
export function sessionRouterDependencies(
  database: Database,
  sessions: Partial<AppRouterDependencies['sessions']> = {},
): AppRouterDependencies {
  return {
    accounts: {},
    catalog: {},
    harnessSignIn: {},
    projects: { database },
    sessions: {
      database,
      journal: new SessionEventJournal(),
      hasLiveChannel: () => false,
      readHistory: async () => [],
      roster: new SessionRosterChanges(),
      watchedStatus: { statusOf: () => null },
      supervisor: {
        getSnapshot: () => ({ context: { sessions: {} } }),
        send: () => {},
        on: () => ({ unsubscribe: () => {} }),
      },
      ...sessions,
    },
    tickets: {},
    workspaces: { database },
  } as unknown as AppRouterDependencies
}
