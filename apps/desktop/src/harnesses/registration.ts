import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main'
import type {
  SessionHistoryRow,
  SessionHistoryTarget,
} from '@/domains/sessions/api/session-history'
import type { HarnessInfo } from '@/harnesses/catalog/harness-catalog-machine'
import type { Harness } from './harness'

export type HarnessRegistration<Id extends Harness = Harness> = HarnessReadinessRegistration & {
  harness: Id
  readCatalog: () => Promise<HarnessInfo>
  readHistory: (target: SessionHistoryTarget) => Promise<SessionHistoryRow[]>
  rename?: (nativeId: string, title: string) => Promise<void>
}
