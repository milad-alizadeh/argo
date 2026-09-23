import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type {
  SessionAdapter,
  SessionCommandOutcome,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { WatchedSource } from '@/platform/main/watch/watch-source'

export type CodexSessionAdapter = SessionAdapter & {
  close: () => Promise<void>
  projections: () => readonly SessionProjection[]
  refreshHistory: (notifyLateSuccess: () => boolean) => Promise<readonly SessionProjection[]>
  readHistoryProjection: (nativeId: string) => Promise<SessionProjection | null>
  watchedProjections: () => readonly SessionProjection[]
  checkoutFor: (nativeId: string) => string | null
  onRosterChanged: WatchedSource
  // A follow-up after a restart: the Session is on disk, and this window does not hold it yet.
  resume: (request: {
    session: SessionIdentity
    workspace: WorkspaceSelection
    cwd: string
    prompt: string
  }) => Promise<SessionCommandOutcome>
}
