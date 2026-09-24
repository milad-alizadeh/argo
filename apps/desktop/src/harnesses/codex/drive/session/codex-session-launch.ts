import { createActor } from 'xstate'
import type { CodexTurnSetup } from '@/domains/sessions/contract/codex-turn-setup'
import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import { beginWatchedResume } from '../../history/resume-watched'
import { type HistoryTransport, readResumePermission } from '../../history/vendor-history'
import type { AppServerSupervisor } from '../supervision/app-server-supervisor-machine'
import type {
  createManagedSessionMachine,
  ManagedSessionInput,
} from '../supervision/managed-session-machine'
import { executeSend, requireSessionEntry, type SessionRegistry } from './codex-session-commands'
import { CodexSessionDriverError } from './codex-session-error'
import type { ManagedSessionActor } from './codex-session-projection'
import { waitForManaged } from './codex-session-ready'

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

export async function startCodexSession(options: {
  launch: Launch & {
    resolveWorkspace: (
      selection: WorkspaceSelection,
    ) => Promise<{ workspaceId: string; cwd: string }>
  }
  selection: WorkspaceSelection
  prompt: string
  setup: CodexTurnSetup
}) {
  const { launch, selection, prompt, setup } = options
  const { workspaceId, cwd } = await launch.resolveWorkspace(selection)
  const identity = await open(launch, { kind: 'start', workspaceId, cwd, setup })
  const outcome = await executeSend(requireSessionEntry(launch.registry, identity), prompt, setup)
  return outcome.kind === 'accepted' ? outcome : { kind: 'uncertain' as const, session: identity }
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
