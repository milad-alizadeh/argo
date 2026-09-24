import { createActor } from 'xstate'
import type { ClaudeTurnSetup } from '@/domains/sessions/contract/claude-turn-setup'
import type { SessionService } from '@/domains/sessions/main/lifecycle/session-service'
import type * as SessionContract from '@/domains/sessions/next/contract/session-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import { createClaudeSessionMachine } from './claude-session-actor'
import { type ClaudeSessionActor, projectionFrom } from './claude-session-projection'
import type { sessionRegistry } from './claude-session-registry'
import type { ClaudeQueryFactory } from './types'

export async function openClaudeSession(options: {
  command: {
    session: SessionContract.SessionIdentity | null
    prompt: string
    startTurn?: boolean
    workspace: SessionContract.WorkspaceSelection
    cwd?: string
    setup?: ClaudeTurnSetup
  }
  deps: {
    sessionService: SessionService
    waitForWorkspaceReady: (workspaceId: string) => Promise<void>
    resolveWorkspace: (
      selection: SessionContract.WorkspaceSelection,
    ) => Promise<{ workspaceId: string; cwd: string }>
    createQuery: ClaudeQueryFactory
    now: () => Date
  }
  register: (actor: ClaudeSessionActor) => void
  requireEntry: (
    session: SessionContract.SessionIdentity,
  ) => ReturnType<typeof sessionRegistry>['requireEntry'] extends (
    session: SessionContract.SessionIdentity,
  ) => infer Entry
    ? Entry
    : never
}) {
  const { command, deps, register, requireEntry } = options
  const { workspaceId, cwd: workspaceCwd } = await deps.resolveWorkspace(command.workspace)
  await deps.waitForWorkspaceReady(workspaceId)
  const actor = createActor(
    createClaudeSessionMachine({
      session: command.session,
      workspaceId,
      prompt: command.prompt,
      startTurn: command.startTurn,
      cwd: command.cwd ?? workspaceCwd,
      startedAt: deps.now().toISOString(),
      createQuery: deps.createQuery,
      sessionService: deps.sessionService,
      setup: command.setup,
    }),
    { input: undefined },
  ).start()
  register(actor)
  return new Promise<SessionCommandOutcome>((resolve) => {
    const subscription = actor.subscribe((snapshot) => {
      const opening = OPENING_OUTCOMES[String(snapshot.value)]
      if (opening === undefined) return
      subscription.unsubscribe()
      const session = snapshot.context.session
      if (opening === 'rejected' || session === null) {
        resolve(
          command.session === null && session !== null
            ? { kind: 'uncertain', session }
            : { kind: 'rejected', reason: 'Claude did not open a channel to this Session.' },
        )
        return
      }
      const entry = requireEntry(session)
      resolve({ kind: 'accepted', projection: projectionFrom(snapshot, entry.revision) })
    })
  })
}

// A resume carries its Session's identity in from the caller, so identity alone never proved the
// SDK had answered: the outcome waits for a state that says whether the channel opened (#2627).
const OPENING_OUTCOMES: Record<string, 'accepted' | 'rejected' | undefined> = {
  Managed: 'accepted',
  Watched: 'accepted',
  Unavailable: 'rejected',
  Closed: 'rejected',
}
