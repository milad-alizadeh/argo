import type { SessionRosterRow } from '@/domains/sessions/contract/model'
import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type {
  SessionAdapter,
  SessionCommandOutcome,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { watchedChanges } from './claude-session-watch'

export type ClaudeSessionAdapter = SessionAdapter & {
  close: () => void
  roster: () => SessionRosterRow[]
  liveMessages: (sessionId: string) => { id: string; text: string }[]
  projection: (session: SessionIdentity) => SessionProjection | null
  onRosterChanged: ReturnType<typeof watchedChanges>
  resume: (request: {
    session: SessionIdentity
    workspace: WorkspaceSelection
    prompt: string
    cwd: string
  }) => Promise<SessionCommandOutcome>
  rename: (sessionId: string, title: string) => Promise<void>
}
