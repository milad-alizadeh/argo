import { claudeTurnSetupSchema } from '@/domains/sessions/contract/claude-turn-setup'
import type { SessionCommand } from '@/domains/sessions/next/contract/session-command-contract'
import type { WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'
import type {
  SessionCommandOutcome,
  Unsubscribe,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { SessionService } from '@/domains/sessions/next/main/session-service'
import { acceptedSessionOutcome } from './accepted-session-outcome'
import { createClaudeQuery } from './claude-agent-sdk'
import type { ClaudeSessionAdapter } from './claude-session-adapter-contract'
import { eventFor } from './claude-session-command-event'
import { keyOf } from './claude-session-key'
import { openClaudeSession } from './claude-session-open'
import { sessionRegistry } from './claude-session-registry'
import { sendWhenManaged } from './send-when-managed'
import type { ClaudeQueryFactory } from './types'

export function watchedChanges(changed: Set<() => void>) {
  return (listener: () => void) => {
    changed.add(listener)
    return () => changed.delete(listener)
  }
}

async function executeCommand(
  command: SessionCommand,
  runtime: Parameters<typeof openClaudeSession>[0]['deps'],
  registry: ReturnType<typeof sessionRegistry>,
): Promise<SessionCommandOutcome> {
  if (command.type === 'session.start')
    return openClaudeSession({
      command: {
        ...command,
        session: null,
        setup: command.setup === undefined ? undefined : claudeTurnSetupSchema.parse(command.setup),
      },
      deps: runtime,
      register: registry.register,
      requireEntry: registry.requireEntry,
    })
  if (command.type === 'session.compact') {
    const entry = registry.requireEntry(command.session)
    entry.actor.send({ type: 'Send', prompt: '/compact' })
    entry.revision += 1
    return acceptedSessionOutcome(entry)
  }
  const entry = registry.requireEntry(command.session)
  entry.actor.send(eventFor(command))
  entry.revision += 1
  if (command.type === 'session.send') return { kind: 'uncertain' }
  return acceptedSessionOutcome(entry)
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
    execute: (command) => executeCommand(command, runtime, registry),
    subscribe: (session, listener) => {
      const entry = registry.requireEntry(session)
      entry.listeners.add(listener)
      return (() => entry.listeners.delete(listener)) as Unsubscribe
    },
    resume: async ({ session, workspace, prompt, cwd }) => {
      const entry = registry.entries.get(keyOf(session))
      if (entry !== undefined) {
        if (!(await sendWhenManaged(entry.actor, prompt))) {
          return { kind: 'rejected', reason: 'The Claude Session is no longer managed.' }
        }
        entry.revision += 1
        return acceptedSessionOutcome(entry)
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
    projection: registry.projection,
    onRosterChanged: watchedChanges(changed),
    close: registry.close,
  }
}

export type { ClaudeSessionAdapter } from './claude-session-adapter-contract'
