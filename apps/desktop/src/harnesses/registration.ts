import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main'
import type {
  SessionHistoryRow,
  SessionHistoryTarget,
} from '@/domains/sessions/api/session-history'
import type { Harness } from './harness'
import type { SessionDiscoveryJobFor } from './session-sync-job'

export type HarnessRegistration<Id extends Harness = Harness> = HarnessReadinessRegistration & {
  harness: Id
  readHistory: (target: SessionHistoryTarget) => Promise<SessionHistoryRow[]>
  rename?: (nativeId: string, title: string) => Promise<void>
  sessionDiscovery: SessionDiscoveryJobFor<Id>
}
