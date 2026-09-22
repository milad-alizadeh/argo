import type { SessionCommand } from '@/domains/sessions/next/contract/session-command-contract'
import type {
  SessionIdentity,
  WorkspaceSelection,
} from '@/domains/sessions/next/contract/session-contract'
import type {
  SessionCommandOutcome,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import { CodexSessionDriverError } from '@/harnesses/codex/drive/session/codex-session-error'
import {
  type ManagedSessionActor,
  type ManagedSessionSnapshot,
  projectionFrom,
} from '@/harnesses/codex/drive/session/codex-session-projection'
import type { ManagedSessionEvent } from '@/harnesses/codex/drive/supervision/managed-session-machine'

export type SessionRegistryEntry = {
  actor: ManagedSessionActor
  revision: number
  listeners: Set<(projection: SessionProjection) => void>
  sendQueue: Promise<void>
}

export type SessionRegistry = Map<string, SessionRegistryEntry>

export function requireSessionEntry(registry: SessionRegistry, session: SessionIdentity) {
  const entry = registry.get(`${session.harness}:${session.nativeId}`)
  if (entry === undefined) throw new CodexSessionDriverError('missing-session')
  return entry
}

function eventFor(
  command: Exclude<SessionCommand, { type: 'session.start' }>,
): ManagedSessionEvent {
  switch (command.type) {
    case 'session.send':
      return { type: 'Send', prompt: command.prompt }
    case 'session.steer':
      return { type: 'Steer', prompt: command.prompt }
    case 'session.interrupt':
      return { type: 'Interrupt' }
    case 'session.decide':
      return { type: 'Decide', decision: command.decision }
    case 'session.answer':
      return { type: 'Answer', answer: command.answer }
    case 'session.rename':
      return { type: 'Rename', title: command.title }
    case 'session.compact':
      return { type: 'Compact' }
    case 'session.close':
      return { type: 'Close' }
  }
}

type CommandSettlement = {
  outcome: NonNullable<ManagedSessionSnapshot['context']['lastSendOutcome']>
  rejection: string | null
}

function waitForCommandSettlement(actor: ManagedSessionActor): Promise<CommandSettlement> {
  const baseline = actor.getSnapshot().context.sendSequence
  return new Promise((resolve) => {
    const settle = (snapshot: ManagedSessionSnapshot) => {
      const settled =
        snapshot.context.sendSequence !== baseline && snapshot.context.lastSendOutcome !== null
      if (!settled && snapshot.status !== 'done' && snapshot.status !== 'stopped') return
      subscription.unsubscribe()
      resolve(
        settled
          ? {
              outcome: snapshot.context.lastSendOutcome as CommandSettlement['outcome'],
              rejection: snapshot.context.lastSendRejection,
            }
          : {
              outcome: 'rejected',
              rejection: snapshot.context.lastSendRejection ?? 'Codex closed the thread',
            },
      )
    }
    const subscription = actor.subscribe(settle)
    settle(actor.getSnapshot())
  })
}

function waitForIdle(actor: ManagedSessionActor): Promise<boolean> {
  const snapshot = actor.getSnapshot()
  if (snapshot.matches({ Active: 'Idle' })) return Promise.resolve(true)
  if (!snapshot.matches('Active')) return Promise.resolve(false)
  return new Promise((resolve) => {
    const subscription = actor.subscribe((next) => {
      if (next.matches({ Active: 'Idle' })) {
        subscription.unsubscribe()
        resolve(true)
      } else if (!next.matches('Active')) {
        subscription.unsubscribe()
        resolve(false)
      }
    })
  })
}

export async function executeCommand(
  command: SessionCommand,
  registry: SessionRegistry,
  start: (selection: WorkspaceSelection, prompt: string) => Promise<SessionCommandOutcome>,
): Promise<SessionCommandOutcome> {
  if (command.type === 'session.start') return start(command.workspace, command.prompt)
  const entry = requireSessionEntry(registry, command.session)
  if (command.type === 'session.send') return executeSend(entry, command.prompt)
  entry.actor.send(eventFor(command))
  entry.revision += 1
  return {
    kind: 'accepted',
    projection: projectionFrom(entry.actor.getSnapshot(), entry.revision),
  }
}

export async function executeSend(
  entry: SessionRegistryEntry,
  prompt: string,
): Promise<SessionCommandOutcome> {
  const previous = entry.sendQueue
  let release: () => void = () => {}
  entry.sendQueue = new Promise((resolve) => {
    release = resolve
  })
  await previous
  try {
    if (!(await waitForIdle(entry.actor))) {
      return { kind: 'rejected', reason: 'Codex cannot accept a follow-up Turn' }
    }
    const settlement = waitForCommandSettlement(entry.actor)
    entry.actor.send({ type: 'Send', prompt })
    entry.revision += 1
    const result = await settlement
    if (result.outcome === 'uncertain') return { kind: 'uncertain' }
    if (result.outcome === 'rejected') {
      return { kind: 'rejected', reason: result.rejection ?? 'Codex rejected the send' }
    }
    return {
      kind: 'accepted',
      projection: projectionFrom(entry.actor.getSnapshot(), entry.revision),
    }
  } finally {
    release()
  }
}
