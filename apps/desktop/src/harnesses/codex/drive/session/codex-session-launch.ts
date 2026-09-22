import { createActor } from 'xstate'
import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import type { SessionService } from '@/domains/sessions/next/main/session-service'
import type { AppServerSupervisor } from '@/harnesses/codex/drive/supervision/app-server-supervisor-machine'
import {
  executeSend,
  requireSessionEntry,
  type SessionRegistry,
} from '@/harnesses/codex/drive/session/codex-session-commands'
import { CodexSessionDriverError } from '@/harnesses/codex/drive/session/codex-session-error'
import type { ManagedSessionActor } from '@/harnesses/codex/drive/session/codex-session-projection'
import { waitForManaged } from '@/harnesses/codex/drive/session/codex-session-ready'
import type {
  createManagedSessionMachine,
  ManagedSessionInput,
} from '@/harnesses/codex/drive/supervision/managed-session-machine'
import { beginWatchedResume } from '@/harnesses/codex/history/resume-watched'
import {
  type HistoryTransport,
  readResumePermission,
} from '@/harnesses/codex/history/vendor-history'

function keyOf(session: SessionIdentity): string {
  return `${session.harness}:${session.nativeId}`
}

function waitForIdentity(actor: ManagedSessionActor): Promise<void> {
  const initial = actor.getSnapshot()
  if (initial.context.sessionId !== null) return Promise.resolve()
  if (initial.matches('Failed')) return Promise.reject(new CodexSessionDriverError('launch-failed'))
  return new Promise((resolve, reject) => {
    const subscription = actor.subscribe((snapshot) => {
      if (snapshot.context.sessionId !== null) {
        subscription.unsubscribe()
        resolve()
      } else if (snapshot.matches('Failed')) {
        subscription.unsubscribe()
        reject(new CodexSessionDriverError('launch-failed'))
      }
    })
  })
}

export function waitForChannel(supervisor: AppServerSupervisor): Promise<void> {
  if (supervisor.getChannel() !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const subscription = supervisor.actor.subscribe((snapshot) => {
      if (supervisor.getChannel() !== null) {
        subscription.unsubscribe()
        resolve()
      } else if (snapshot.matches('Backoff')) {
        subscription.unsubscribe()
        reject(new CodexSessionDriverError('launch-failed'))
      }
    })
    if (supervisor.getChannel() !== null) {
      subscription.unsubscribe()
      resolve()
    }
  })
}

type Launch = {
  machine: ReturnType<typeof createManagedSessionMachine>
  register: (actor: ManagedSessionActor) => void
  registry: SessionRegistry
  supervisor: AppServerSupervisor
  sessionService: SessionService
  history: HistoryTransport
}

async function open(launch: Launch, input: ManagedSessionInput) {
  await waitForChannel(launch.supervisor)
  const actor = createActor(launch.machine, { input }).start()
  if (input.kind === 'start') {
    launch.register(actor)
    await waitForIdentity(actor)
    return actor.getSnapshot().context.sessionId as SessionIdentity
  }
  try {
    await waitForManaged(actor)
  } catch (error) {
    actor.stop()
    throw error
  }
  launch.register(actor)
  return actor.getSnapshot().context.sessionId as SessionIdentity
}

export async function startCodexSession(
  launch: Launch & {
    resolveWorkspace: (
      selection: WorkspaceSelection,
    ) => Promise<{ workspaceId: string; cwd: string }>
  },
  selection: WorkspaceSelection,
  prompt: string,
) {
  const { workspaceId, cwd } = await launch.resolveWorkspace(selection)
  const identity = await open(launch, { kind: 'start', workspaceId, cwd })
  return executeSend(requireSessionEntry(launch.registry, identity), prompt)
}

export async function resumeCodexSession(
  launch: Launch & {
    resolveWorkspace: (
      selection: WorkspaceSelection,
    ) => Promise<{ workspaceId: string; cwd: string }>
  },
  request: {
    session: SessionIdentity
    workspace: WorkspaceSelection
    cwd: string
    prompt: string
  },
): Promise<SessionCommandOutcome> {
  const existing = launch.registry.get(keyOf(request.session))
  if (existing !== undefined) return executeSend(existing, request.prompt)
  return beginWatchedResume({
    readPermission: () => readResumePermission(launch.history, request.session.nativeId),
    acquireLease: () => launch.sessionService.acquire(request.session),
    releaseLease: () => launch.sessionService.release(request.session),
    openManaged: async () => {
      const { workspaceId } = await launch.resolveWorkspace(request.workspace)
      await open(launch, {
        kind: 'resume',
        sessionId: request.session,
        workspaceId,
        cwd: request.cwd,
      })
      return executeSend(requireSessionEntry(launch.registry, request.session), request.prompt)
    },
  })
}
