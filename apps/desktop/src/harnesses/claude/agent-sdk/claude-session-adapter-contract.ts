import type { ClaudeModelCatalog } from '@/domains/sessions/contract/claude-model-catalog'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type {
  SessionAdapter,
  SessionCommandOutcome,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { watchedChanges } from './claude-session-adapter'

export type ClaudeSessionAdapter = SessionAdapter & {
  close: () => void
  readModelCatalog: () => Promise<ClaudeModelCatalog | null>
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
