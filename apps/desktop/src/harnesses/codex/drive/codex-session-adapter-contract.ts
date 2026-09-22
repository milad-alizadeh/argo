import type {
  SessionAdapter,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { WatchedSource } from '@/platform/main/watch/watch-source'

export type CodexSessionAdapter = SessionAdapter & {
  close: () => void
  projections: () => readonly SessionProjection[]
  onRosterChanged: WatchedSource
}
