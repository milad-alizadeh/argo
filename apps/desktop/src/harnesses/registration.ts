import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main'
import type { SessionDiscovery } from '@/domains/sessions/api/session-discovery'
import type {
  SessionHistoryRow,
  SessionHistoryTarget,
} from '@/domains/sessions/api/session-history'
import type { Harness } from './harness'

export type HarnessRegistration<Id extends Harness = Harness> = HarnessReadinessRegistration & {
  harness: Id
  readHistory: (target: SessionHistoryTarget) => Promise<SessionHistoryRow[]>
  rename?: (nativeId: string, title: string) => Promise<void>
  sessionDiscovery: SessionDiscovery
}
