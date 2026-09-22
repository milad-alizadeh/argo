import { createActor } from 'xstate'
import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type {
  SessionCommandOutcome,
  Unsubscribe,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { SessionService } from '@/domains/sessions/next/main/session-service'
import { createClaudeQuery } from '@/harnesses/claude/agent-sdk/claude-agent-sdk'
import { createClaudeSessionMachine } from '@/harnesses/claude/agent-sdk/claude-session-actor'
import type { ClaudeSessionAdapter } from '@/harnesses/claude/agent-sdk/claude-session-adapter-contract'
import { eventFor } from '@/harnesses/claude/agent-sdk/claude-session-command-event'
import { keyOf } from '@/harnesses/claude/agent-sdk/claude-session-key'
import type { ClaudeSessionActor } from '@/harnesses/claude/agent-sdk/claude-session-projection'
import { projectionFrom } from '@/harnesses/claude/agent-sdk/claude-session-projection'
import { sessionRegistry } from '@/harnesses/claude/agent-sdk/claude-session-registry'
import { watchedChanges } from '@/harnesses/claude/agent-sdk/claude-session-watch'
import type { ClaudeQueryFactory } from '@/harnesses/claude/agent-sdk/types'

async function openClaudeSession(options: {
  command: {
    session: SessionIdentity | null
    prompt: string
    workspace: WorkspaceSelection
    cwd?: string
  }
  deps: {
    sessionService: SessionService
    waitForWorkspaceReady: (workspaceId: string) => Promise<void>
    resolveWorkspace: (
      selection: WorkspaceSelection,
    ) => Promise<{ workspaceId: string; cwd: string }>
    createQuery: ClaudeQueryFactory
    now: () => Date
  }
  register: (actor: ClaudeSessionActor) => void
  requireEntry: (
    session: SessionIdentity,
  ) => ReturnType<typeof sessionRegistry>['requireEntry'] extends (
    session: SessionIdentity,
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
      cwd: command.cwd ?? workspaceCwd,
      startedAt: deps.now().toISOString(),
      createQuery: deps.createQuery,
      renameSession: async () => {},
      sessionService: deps.sessionService,
    }),
    { input: undefined },
  ).start()
  register(actor)
  return new Promise<SessionCommandOutcome>((resolve) => {
    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.context.session === null) return
      subscription.unsubscribe()
      const entry = requireEntry(snapshot.context.session)
      resolve({ kind: 'accepted', projection: projectionFrom(snapshot, entry.revision) })
    })
  })
}
function accepted(
  entry: ReturnType<typeof sessionRegistry>['requireEntry'] extends (
    session: SessionIdentity,
  ) => infer Entry
    ? Entry
    : never,
) {
  return {
    kind: 'accepted' as const,
    projection: projectionFrom(entry.actor.getSnapshot(), entry.revision),
  }
}
export function createClaudeSessionAdapter(deps: {
  sessionService: SessionService
  waitForWorkspaceReady: (workspaceId: string) => Promise<void>
  resolveWorkspace: (selection: WorkspaceSelection) => Promise<{ workspaceId: string; cwd: string }>
  createQuery?: ClaudeQueryFactory
  now?: () => Date
}): ClaudeSessionAdapter {
  const runtime = {
    ...deps,
    createQuery: deps.createQuery ?? createClaudeQuery,
    now: deps.now ?? (() => new Date()),
  }
  const changed = new Set<() => void>()
  const registry = sessionRegistry(changed, deps.sessionService)
  return {
    execute: async (command) => {
      if (command.type === 'session.start')
        return openClaudeSession({
          command: { ...command, session: null },
          deps: runtime,
          register: registry.register,
          requireEntry: registry.requireEntry,
        })
      if (command.type === 'session.compact') {
        const entry = registry.requireEntry(command.session)
        entry.actor.send({ type: 'Send', prompt: '/compact' })
        entry.revision += 1
        return accepted(entry)
      }
      const entry = registry.requireEntry(command.session)
      entry.actor.send(eventFor(command))
      entry.revision += 1
      if (command.type === 'session.send') return { kind: 'uncertain' }
      return accepted(entry)
    },
    subscribe: (session, listener) => {
      const entry = registry.requireEntry(session)
      entry.listeners.add(listener)
      return (() => entry.listeners.delete(listener)) as Unsubscribe
    },
    resume: async ({ session, workspace, prompt, cwd }) => {
      const entry = registry.entries.get(keyOf(session))
      if (entry !== undefined) {
        entry.actor.send({ type: 'Send', prompt })
        entry.revision += 1
        return accepted(entry)
      }
      return openClaudeSession({
        command: { session, workspace, prompt, cwd },
        deps: runtime,
        register: registry.register,
        requireEntry: registry.requireEntry,
      })
    },
    rename: async (sessionId, title) => {
      const entry = registry.requireEntry({ harness: 'claude', nativeId: sessionId })
      entry.actor.send({ type: 'Rename', title })
      entry.revision += 1
    },
    roster: registry.roster,
    liveMessages: registry.liveMessages,
    onRosterChanged: watchedChanges(changed),
    close: registry.close,
  }
}

export type { ClaudeSessionAdapter } from './claude-session-adapter-contract'
