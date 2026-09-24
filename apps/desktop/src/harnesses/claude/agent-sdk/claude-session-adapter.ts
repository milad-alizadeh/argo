import { PROJECT_PROOF_STORE_ENV } from '@/domains/projects/main/proof-protocol'
import type { ClaudeModelCatalog } from '@/domains/sessions/contract/claude-model-catalog'
import {
  claudeOpeningSetupFor,
  claudeTurnSetupSchemaFor,
} from '@/domains/sessions/contract/claude-turn-setup'
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
import { beginWatchedClaudeResume, readClaudeResumePermission } from './claude-watched-resume'
import { ClaudeModelCatalogCache, readClaudeModelCatalog } from './model-catalog'
import { sendWhenManaged } from './send-when-managed'
import type { ClaudeQueryFactory } from './types'

export function watchedChanges(changed: Set<() => void>) {
  return (listener: () => void) => {
    changed.add(listener)
    return () => changed.delete(listener)
  }
}

async function executeCommand(options: {
  command: SessionCommand
  runtime: Parameters<typeof openClaudeSession>[0]['deps']
  registry: ReturnType<typeof sessionRegistry>
  readModelCatalog: () => ReturnType<typeof readClaudeModelCatalog>
}): Promise<SessionCommandOutcome> {
  const { command, runtime, registry, readModelCatalog } = options
  if (command.type === 'session.start') {
    const catalog = await readModelCatalog()
    if (catalog === null)
      return { kind: 'rejected', reason: 'Claude model catalog is unavailable.' }
    const setup = command.setup ?? claudeOpeningSetupFor(catalog)
    const parsed = claudeTurnSetupSchemaFor(catalog).safeParse(setup)
    if (!parsed.success || parsed.data === undefined)
      return { kind: 'rejected', reason: 'Claude does not support the selected Model and Effort.' }
    return openClaudeSession({
      command: {
        ...command,
        session: null,
        setup: parsed.data,
      },
      deps: runtime,
      register: registry.register,
      requireEntry: registry.requireEntry,
    })
  }
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
  readResumePermission?: (
    sessionId: string,
  ) => Promise<{ resumable: true } | { resumable: false; reason: string }>
  now?: () => Date
  findExecutablePath?: () => string | null
  readModelCatalog?: () => Promise<ClaudeModelCatalog | null>
}): ClaudeSessionAdapter {
  // The packaged proof mock stores sessions only in its transcript fixture, not the Agent SDK.
  const defaultReadResumePermission = process.env[PROJECT_PROOF_STORE_ENV]
    ? async () => ({ resumable: true as const })
    : readClaudeResumePermission
  const runtime = {
    ...deps,
    createQuery: deps.createQuery ?? createClaudeQuery,
    now: deps.now ?? (() => new Date()),
    readResumePermission: deps.readResumePermission ?? defaultReadResumePermission,
  }
  const changed = new Set<() => void>()
  const registry = sessionRegistry(changed, deps.sessionService)
  const catalogCache = new ClaudeModelCatalogCache()
  const readModelCatalog =
    deps.readModelCatalog ??
    (() =>
      readClaudeModelCatalog({
        executablePath: deps.findExecutablePath?.() ?? null,
        cache: catalogCache,
      }))
  return {
    execute: (command) => executeCommand({ command, runtime, registry, readModelCatalog }),
    readModelCatalog,
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
      return beginWatchedClaudeResume({
        readPermission: () => runtime.readResumePermission(session.nativeId),
        acquireLease: () => runtime.sessionService.acquire(session),
        releaseLease: () => runtime.sessionService.release(session),
        openManaged: () =>
          openClaudeSession({
            command: { session, workspace, prompt, cwd },
            deps: runtime,
            register: registry.register,
            requireEntry: registry.requireEntry,
          }),
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
