import { createActor } from 'xstate'
import type { SessionCommand } from '@/domains/sessions/next/contract/session-command-contract'
import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type {
  SessionAdapter,
  SessionCommandOutcome,
  SessionProjection,
  Unsubscribe,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { SessionService } from '@/domains/sessions/next/main/session-service'
import { createClaudeQuery, renameSession } from '@/harnesses/claude/agent-sdk/claude-agent-sdk'
import { createClaudeSessionMachine } from '@/harnesses/claude/agent-sdk/claude-session-actor'
import {
  type ClaudeSessionActor,
  projectionFrom,
} from '@/harnesses/claude/agent-sdk/claude-session-projection'
import type { ClaudeQueryFactory } from '@/harnesses/claude/agent-sdk/types'

type RegistryEntry = {
  actor: ClaudeSessionActor
  revision: number
  listeners: Set<(projection: SessionProjection) => void>
}
type Registry = Map<string, RegistryEntry>

function keyOf(session: SessionIdentity): string {
  return `${session.harness}:${session.nativeId}`
}

function eventFor(command: Exclude<SessionCommand, { type: 'session.start' | 'session.compact' }>) {
  switch (command.type) {
    case 'session.send':
      return { type: 'Send', prompt: command.prompt } as const
    case 'session.steer':
      return { type: 'Steer', prompt: command.prompt } as const
    case 'session.interrupt':
      return { type: 'Interrupt' } as const
    case 'session.decide':
      return { type: 'Decide', approvalId: command.approvalId, decision: command.decision } as const
    case 'session.answer':
      return { type: 'Answer', questionId: command.questionId, answer: command.answer } as const
    case 'session.rename':
      return { type: 'Rename', title: command.title } as const
    case 'session.close':
      return { type: 'Close' } as const
  }
}

async function startClaudeSession(options: {
  command: Extract<SessionCommand, { type: 'session.start' }>
  deps: {
    sessionService: SessionService
    waitForWorkspaceReady: (workspaceId: string) => Promise<void>
    resolveWorkspace: (
      selection: WorkspaceSelection,
    ) => Promise<{ workspaceId: string; cwd: string }>
    createQuery: ClaudeQueryFactory
    renameSession: (sessionId: string, title: string) => Promise<void>
  }
  register: (actor: ClaudeSessionActor) => void
  requireEntry: (session: SessionIdentity) => RegistryEntry
}) {
  const { command, deps, register, requireEntry } = options
  const { workspaceId, cwd } = await deps.resolveWorkspace(command.workspace)
  await deps.waitForWorkspaceReady(workspaceId)
  const actor = createActor(
    createClaudeSessionMachine({
      session: null,
      workspaceId,
      prompt: command.prompt,
      cwd,
      createQuery: deps.createQuery,
      renameSession: deps.renameSession,
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

export function createClaudeSessionAdapter(deps: {
  sessionService: SessionService
  waitForWorkspaceReady: (workspaceId: string) => Promise<void>
  resolveWorkspace: (selection: WorkspaceSelection) => Promise<{ workspaceId: string; cwd: string }>
  createQuery?: ClaudeQueryFactory
  renameSession?: (sessionId: string, title: string) => Promise<void>
}): ClaudeSessionAdapter {
  const runtime = {
    ...deps,
    createQuery: deps.createQuery ?? createClaudeQuery,
    renameSession: deps.renameSession ?? renameSession,
  }
  const registry: Registry = new Map()
  const requireEntry = (session: SessionIdentity) => {
    const entry = registry.get(keyOf(session))
    if (entry === undefined) throw new Error('Claude Session is not managed')
    return entry
  }
  const register = (actor: ClaudeSessionActor) => {
    actor.subscribe((snapshot) => {
      if (snapshot.context.session === null) return
      const key = keyOf(snapshot.context.session)
      const entry = registry.get(key) ?? { actor, revision: 0, listeners: new Set() }
      registry.set(key, entry)
      entry.revision += 1
      const projection = projectionFrom(snapshot, entry.revision)
      for (const listener of entry.listeners) listener(projection)
    })
  }
  return {
    execute: async (command) => {
      if (command.type === 'session.start')
        return startClaudeSession({ command, deps: runtime, register, requireEntry })
      if (command.type === 'session.compact')
        return { kind: 'rejected', reason: 'Claude does not support manual compaction' }
      const entry = requireEntry(command.session)
      entry.actor.send(eventFor(command))
      entry.revision += 1
      if (command.type === 'session.send') return { kind: 'uncertain' }
      return {
        kind: 'accepted',
        projection: projectionFrom(entry.actor.getSnapshot(), entry.revision),
      }
    },
    subscribe: (session, listener) => {
      const entry = requireEntry(session)
      entry.listeners.add(listener)
      return (() => entry.listeners.delete(listener)) as Unsubscribe
    },
    close: () => {
      for (const entry of registry.values()) {
        const session = entry.actor.getSnapshot().context.session
        if (session !== null) deps.sessionService.release(session)
        entry.actor.stop()
      }
    },
  }
}

export type ClaudeSessionAdapter = SessionAdapter & { close: () => void }
