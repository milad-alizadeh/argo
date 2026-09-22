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
  close: () => void
  projections: () => readonly SessionProjection[]
  onRosterChanged: WatchedSource
  // A follow-up after a restart: the Session is on disk, and this window does not hold it yet.
  resume: (request: {
    session: SessionIdentity
    workspace: WorkspaceSelection
    cwd: string
    prompt: string
  }) => Promise<SessionCommandOutcome>
}
