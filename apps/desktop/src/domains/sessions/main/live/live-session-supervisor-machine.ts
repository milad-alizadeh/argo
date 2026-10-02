import { randomUUID } from 'node:crypto'
import {
  type ActorRefFrom,
  assign,
  emit,
  enqueueActions,
  fromCallback,
  fromPromise,
  stopChild,
  setup as xstateSetup,
} from 'xstate'
import type { Database } from '@/database/database'
import { sessionWorktreeColumns } from '@/database/session/validation'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { SessionSubmitRejection } from '@/domains/sessions/api/session-submit-rejection'
import type { HarnessRegistry } from '@/harnesses/registry'
import type { harnessCatalogMachine } from '@/platform/main/harness-catalog/harness-catalog-machine'
import type {
  SessionListChanges,
  SessionLiveInput,
  SessionSendInput,
  SessionStartInput,
} from '../api'
import {
  bindSessionCommand,
  createSessionCommandStore,
  createSessionUpsert,
  type SessionCommandStore,
  saveFirstPromptOfUntitled,
  saveSessionSubagents,
  setSessionCommandOutcome,
} from '../database'
import { liveSessionChannelActor } from './live-session-channel-actor'
import { liveSessionMachine } from './live-session-machine'
import type { SessionEventJournal } from './session-event-journal'
import type { SessionInteractionBroker } from './session-interaction-broker'

type LiveSessionActor = ActorRefFrom<typeof liveSessionMachine>
type Delegation = Extract<
  FeedContent,
  {
    kind: 'delegation'
  }
>
function sessionActor(
  self: {
    system: LiveSessionSupervisorActor['system']
  },
  id: string | undefined,
) {
  return id === undefined ? undefined : (self.system.get(id) as LiveSessionActor | undefined)
}

function sessionIsUnavailable(actor: LiveSessionActor): boolean {
  const snapshot = actor.getSnapshot()
  return snapshot.matches('Failed') || snapshot.matches('Closed')
}

// Whether the channel is open and how its next Turn runs; a change here refreshes selected details.
function liveDetailsOf(actor: LiveSessionActor): string {
  return JSON.stringify([
    sessionIsUnavailable(actor),
    actor.getSnapshot().context.turnConfiguration,
  ])
}

export function liveSessionActorFor(supervisor: LiveSessionSupervisorActor, sessionId: string) {
  const { sessions, starts } = supervisor.getSnapshot().context
  const persisted = sessionActor(supervisor, sessions[sessionId])
  if (persisted !== undefined) return persisted
  return Object.values(starts ?? {})
    .map((id) => sessionActor(supervisor, id))
    .find((actor) => actor?.getSnapshot().context.argoId === sessionId)
}

function recordCommandFeed(database: Database, body: SessionLiveEventBody) {
  if (body.commandId === null) return
  if (body.turnId !== null)
    bindSessionCommand(database, body.commandId, {
      turnId: body.turnId,
    })
  switch (body.type) {
    case 'failure':
      setSessionCommandOutcome(database, body.commandId, 'unknown')
      return
    case 'status':
      if (body.status === 'idle') setSessionCommandOutcome(database, body.commandId, 'completed')
      else if (body.status === 'unknown')
        setSessionCommandOutcome(database, body.commandId, 'unknown')
      else if (body.status === 'running')
        setSessionCommandOutcome(database, body.commandId, 'observed')
      return
    case 'content':
      if (body.content.kind === 'message' && body.content.role === 'user')
        setSessionCommandOutcome(database, body.commandId, 'observed')
      return
    case 'permission':
    case 'question':
      return
  }
}

function trackCommandSnapshot(
  database: Database,
  snapshot: ReturnType<LiveSessionActor['getSnapshot']>,
  inFlightCommandId: string | null,
): string | null {
  if (snapshot.matches('Sending')) {
    const nextCommandId = snapshot.context.queue[0]?.commandId
    if (nextCommandId === undefined || nextCommandId === inFlightCommandId) return inFlightCommandId
    if (inFlightCommandId !== null)
      setSessionCommandOutcome(database, inFlightCommandId, 'accepted')
    return nextCommandId
  }
  if (inFlightCommandId === null) return null
  if (snapshot.matches('Ready')) setSessionCommandOutcome(database, inFlightCommandId, 'accepted')
  else if (snapshot.matches('Failed'))
    setSessionCommandOutcome(database, inFlightCommandId, 'unknown')
  else return inFlightCommandId
  return null
}

export function recordLiveSessionEvents(
  session: LiveSessionActor,
  journal?: SessionEventJournal,
  storage?: {
    database: Database
    changes?: SessionListChanges
  },
): () => void {
  let sessionId: string | null = null
  let inFlightCommandId: string | null = session.getSnapshot().context.first.commandId
  const pendingSubagents = new Map<string, Delegation>()
  const eventSubscription = session.on('feed', ({ body }) => {
    if (storage !== undefined) recordCommandFeed(storage.database, body)
    if (storage !== undefined && body.type === 'content' && body.content.kind === 'delegation') {
      if (sessionId === null) pendingSubagents.set(body.content.agentId, body.content)
      else {
        const written = saveSessionSubagents(storage.database, sessionId, [
          body.content,
        ])
        if (written > 0)
          storage.changes?.changed([
            sessionId,
          ])
      }
    }
    if (sessionId === null) journal?.stage(session, body)
    else journal?.append(sessionId, body)
  })
  const subscription = session.subscribe((snapshot) => {
    if (storage !== undefined)
      inFlightCommandId = trackCommandSnapshot(storage.database, snapshot, inFlightCommandId)
    if (sessionId !== null || snapshot.context.argoId === null) return
    sessionId = snapshot.context.argoId
    if (storage !== undefined && pendingSubagents.size > 0) {
      const written = saveSessionSubagents(storage.database, sessionId, [
        ...pendingSubagents.values(),
      ])
      if (written > 0)
        storage.changes?.changed([
          sessionId,
        ])
      pendingSubagents.clear()
    }
    journal?.bind(session, sessionId)
  })
  return () => {
    subscription.unsubscribe()
    eventSubscription.unsubscribe()
    journal?.discard(session)
  }
}

export function watchIdleSession(
  session: LiveSessionActor,
  milliseconds: number,
  retire: (sessionId: string) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const consider = (snapshot: ReturnType<LiveSessionActor['getSnapshot']>) => {
    clear()
    if (!snapshot.matches('Ready')) return
    timer = setTimeout(() => {
      const sessionId = session.getSnapshot().context.argoId
      if (sessionId !== null) retire(sessionId)
    }, milliseconds)
  }
  const state = session.subscribe(consider)
  consider(session.getSnapshot())
  return () => {
    clear()
    state.unsubscribe()
  }
}
type StartReply = {
  resolve: (value: { sessionId: string }) => void
  reject: (error: Error) => void
}
export class SessionSubmitRejectedError extends Error {}

// A Harness that failed before naming its Session never took the Turn; after that, Argo cannot tell.
function startReachedHarness(nativeId: string | null): boolean {
  return nativeId !== null
}

function startFailure(context: { nativeId: string | null; failure: string | null }): Error {
  if (startReachedHarness(context.nativeId))
    return new Error(context.failure ?? 'Session start failed.')
  return new SessionSubmitRejectedError('harness-start-failed' satisfies SessionSubmitRejection)
}
type CompletedStart =
  | {
      commandId: string
      sessionId: string
    }
  | {
      commandId: string
      failure: string
    }
type SupervisorContext = {
  sessions: Record<string, string>
  starts: Record<string, string>
  completed: Record<string, CompletedStart>
}
type LiveSessionSupervisorInput = {
  database: Database
  registry: HarnessRegistry
  journal?: SessionEventJournal
  interactions?: SessionInteractionBroker
  changes?: SessionListChanges
}
type LiveSessionSupervisorEvent =
  | {
      type: 'Start'
      input: SessionStartInput
      pendingId: string
      reply: StartReply
    }
  | {
      type: 'Send'
      input: SessionSendInput
      intentId: string
      reply: StartReply
    }
  | {
      type: 'Session persisted'
      pendingId: string
      commandId: string
      sessionId: string
    }
  | {
      type: 'Session failed'
      pendingId: string
      commandId: string
      failure: string
      nativeId: string | null
    }
  | {
      type: 'Retire session'
      actorId: string
      sessionId: string
    }
  | {
      type: 'Session status changed'
      sessionId: string
    }
  | {
      type: 'Shutdown'
    }
  | {
      type: 'Interrupt'
      sessionId: string
      reply: {
        resolve: () => void
        reject: (error: Error) => void
      }
    }
  | {
      type: 'Answer permission'
      sessionId: string
      requestId: string
      decision: PermissionDecision
      reply: {
        resolve: (accepted: boolean) => void
        reject: (error: Error) => void
      }
    }
  | {
      type: 'Answer question'
      sessionId: string
      requestId: string
      answers: QuestionAnswer[]
      reply: {
        resolve: (accepted: boolean) => void
        reject: (error: Error) => void
      }
    }

function turnConfigurationIsAvailable(
  catalog: ActorRefFrom<typeof harnessCatalogMachine> | undefined,
  harness: SessionStartInput['harness'],
  turnConfiguration: SessionStartInput['turnConfiguration'],
) {
  const entry = catalog
    ?.getSnapshot()
    .context.catalog.harnesses.find(
      (candidate) => candidate.harness === harness && candidate.availability === 'available',
    )
  if (entry?.availability !== 'available') return false
  const model = entry.models.find((candidate) => candidate.value === turnConfiguration.model)
  if (model === undefined && entry.models.length > 0) return false
  return (
    offers(model?.efforts ?? [], turnConfiguration.effort) &&
    offers(
      entry.modes.map(({ value }) => value),
      turnConfiguration.mode,
    ) &&
    (model?.supportedModes === undefined || model.supportedModes.includes(turnConfiguration.mode))
  )
}

// A setting the Harness reports no choices for draws no control, so it holds no value to refuse.
function offers(choices: readonly string[], value: string) {
  return choices.length === 0 || choices.includes(value)
}

function acceptsTurnConfigurationChange(
  actor: LiveSessionActor,
  turnConfiguration: SessionSendInput['turnConfiguration'],
  registry: HarnessRegistry,
): boolean {
  const { first } = actor.getSnapshot().context
  const changeable = registry[harnessOfInput(first)].changeableTurnSettings
  const opening = first.turnConfiguration
  return (
    [
      'model',
      'effort',
      'mode',
    ] as const
  ).every(
    (setting) => changeable.includes(setting) || opening[setting] === turnConfiguration[setting],
  )
}

function harnessOfInput(input: SessionLiveInput) {
  return 'resume' in input ? input.resume.harness : input.harness
}

function pendingIdOf(
  event: Extract<
    LiveSessionSupervisorEvent,
    {
      type: 'Start' | 'Send'
    }
  >,
) {
  return event.type === 'Start' ? event.pendingId : `resume:${event.input.sessionId}`
}

function replyForCompletedStart(
  completed: CompletedStart | undefined,
  commandId: string,
  reply: StartReply,
) {
  if (completed === undefined) return false
  if (completed.commandId !== commandId) {
    reply.reject(new Error('A conflicting start already completed for this draft.'))
  } else if ('sessionId' in completed) reply.resolve(completed)
  else reply.reject(new Error(completed.failure))
  return true
}

function handledStart({
  context,
  event,
  self,
  observeReply,
  commands,
}: {
  context: SupervisorContext
  event: Extract<
    LiveSessionSupervisorEvent,
    {
      type: 'Start' | 'Send'
    }
  >
  self: {
    system: LiveSessionSupervisorActor['system']
  }
  observeReply: (session: LiveSessionActor, reply: StartReply) => void
  commands: SessionCommandStore
}): boolean {
  const persisted =
    event.type === 'Send' ? sessionActor(self, context.sessions[event.input.sessionId]) : undefined
  if (persisted !== undefined && !sessionIsUnavailable(persisted)) return true
  const pendingId = pendingIdOf(event)
  const catalog = self.system.get('catalog') as
    | ActorRefFrom<typeof harnessCatalogMachine>
    | undefined
  if (
    !turnConfigurationIsAvailable(
      catalog,
      harnessOfInput(event.input),
      event.input.turnConfiguration,
    )
  ) {
    event.reply.reject(
      new SessionSubmitRejectedError('The selected Turn configuration is no longer available.'),
    )
    return true
  }
  // A Send to a retired or failed Session reopens it instead of replaying the earlier resume.
  const reopensSession =
    event.type === 'Send' && context.sessions[event.input.sessionId] !== undefined
  if (
    !reopensSession &&
    replyForCompletedStart(context.completed[pendingId], event.input.commandId, event.reply)
  )
    return true
  const existing = sessionActor(self, context.starts[pendingId])
  if (existing === undefined) return false
  if (existing.getSnapshot().context.first.commandId === event.input.commandId)
    observeReply(existing, event.reply)
  else if (event.type === 'Send') {
    if (reserveActiveCommand(event, commands)) {
      existing.send({
        type: 'Send',
        command: event.input,
      })
      event.reply.resolve({
        sessionId: event.input.sessionId,
      })
    }
  } else event.reply.reject(new Error('A conflicting start is already active for this draft.'))
  return true
}

function reserveOpeningCommand(
  event: Extract<
    LiveSessionSupervisorEvent,
    {
      type: 'Start' | 'Send'
    }
  >,
  commands: SessionCommandStore,
): boolean {
  let outcome: ReturnType<SessionCommandStore['reserve']>
  try {
    outcome = commands.reserve(
      event.input.commandId,
      event.type === 'Send' ? event.input.sessionId : null,
      commandIdentityOf(event),
    )
  } catch (error) {
    event.reply.reject(error instanceof Error ? error : new Error(String(error)))
    return false
  }
  if (outcome.reserved) return true
  if (outcome.sessionId !== null)
    event.reply.resolve({
      sessionId: outcome.sessionId,
    })
  else event.reply.reject(new Error('Session send outcome is uncertain.'))
  return false
}

function commandIdentityOf(
  event: Extract<
    LiveSessionSupervisorEvent,
    {
      type: 'Start' | 'Send'
    }
  >,
) {
  return {
    intentId: event.type === 'Start' ? event.pendingId : event.intentId,
    harness: harnessOfInput(event.input),
    nativeId: event.type === 'Send' ? event.input.resume.nativeId : null,
    cwd: event.type === 'Send' ? event.input.resume.cwd : event.input.cwd,
  }
}

function reserveActiveCommand(
  event: Extract<
    LiveSessionSupervisorEvent,
    {
      type: 'Send'
    }
  >,
  commands: SessionCommandStore,
): boolean {
  let outcome: ReturnType<SessionCommandStore['reserve']>
  try {
    outcome = commands.reserve(
      event.input.commandId,
      event.input.sessionId,
      commandIdentityOf(event),
    )
  } catch (error) {
    event.reply.reject(error instanceof Error ? error : new Error(String(error)))
    return false
  }
  if (outcome.reserved) return true
  event.reply.resolve({
    sessionId: event.input.sessionId,
  })
  return false
}

function selectHarness({
  input,
  dependencies,
  commands,
}: {
  input: SessionLiveInput
  dependencies: LiveSessionSupervisorInput
  commands: SessionCommandStore
}) {
  const harness = harnessOfInput(input)
  const open = dependencies.registry[harness].openLiveSession
  if (open === undefined) throw new Error(`${harness} live channel is unavailable.`)
  return liveSessionChannelActor(open, dependencies.interactions, commands)
}

function sendValidationError(
  actor: LiveSessionActor,
  input: SessionSendInput,
  harnesses: {
    catalog: ActorRefFrom<typeof harnessCatalogMachine> | undefined
    registry: HarnessRegistry
  },
): SessionSubmitRejectedError | null {
  const { catalog, registry } = harnesses
  if (
    !turnConfigurationIsAvailable(
      catalog,
      harnessOfInput(actor.getSnapshot().context.first),
      input.turnConfiguration,
    )
  )
    return new SessionSubmitRejectedError('The selected Turn configuration is no longer available.')
  if (!acceptsTurnConfigurationChange(actor, input.turnConfiguration, registry))
    return new SessionSubmitRejectedError(
      'Changing this Turn configuration requires starting a new Session.',
    )
  const snapshot = actor.getSnapshot()
  if (sessionIsUnavailable(actor))
    return new SessionSubmitRejectedError(
      snapshot.context.failure ?? 'Session is not available for sends.',
    )
  return null
}

export function createLiveSessionSupervisorMachine(dependencies: LiveSessionSupervisorInput) {
  const commands = createSessionCommandStore(dependencies.database)
  return xstateSetup({
    types: {
      context: {} as SupervisorContext,
      events: {} as LiveSessionSupervisorEvent,
      emitted: {} as {
        type: 'Session status changed'
        sessionId: string
      },
    },
    actors: {
      observeIdle: fromCallback<
        {
          type: 'Stop'
        },
        {
          actorId: string
          session: LiveSessionActor
        },
        Extract<
          LiveSessionSupervisorEvent,
          {
            type: 'Retire session'
          }
        >
      >(({ input, sendBack }) => {
        return watchIdleSession(input.session, 5 * 60_000, (sessionId) =>
          sendBack({
            type: 'Retire session',
            actorId: input.actorId,
            sessionId,
          }),
        )
      }),
      observeLiveEvents: fromCallback<
        {
          type: 'Stop'
        },
        {
          session: LiveSessionActor
          stop: () => void
        },
        Extract<
          LiveSessionSupervisorEvent,
          {
            type: 'Session status changed'
          }
        >
      >(({ input, sendBack }) => {
        let previousActivity = input.session.getSnapshot().context.activity.activity
        const subscription = input.session.on('feed', ({ body }) => {
          const snapshot = input.session.getSnapshot()
          const sessionId = snapshot.context.argoId
          const activity = snapshot.context.activity.activity
          const activityChanged =
            activity?.label !== previousActivity?.label ||
            activity?.kind !== previousActivity?.kind ||
            activity?.open !== previousActivity?.open
          previousActivity = activity
          const delegated = body.type === 'content' && body.content.kind === 'delegation'
          if ((body.type === 'status' || activityChanged || delegated) && sessionId !== null)
            sendBack({
              type: 'Session status changed',
              sessionId,
            })
        })
        let previousDetails = liveDetailsOf(input.session)
        const details = input.session.subscribe(() => {
          const current = liveDetailsOf(input.session)
          const sessionId = input.session.getSnapshot().context.argoId
          if (current === previousDetails || sessionId === null) return
          previousDetails = current
          sendBack({
            type: 'Session status changed',
            sessionId,
          })
        })
        return () => {
          subscription.unsubscribe()
          details.unsubscribe()
          input.stop()
        }
      }),
      observeSession: fromCallback<
        {
          type: 'Stop'
        },
        {
          pendingId: string
          session: LiveSessionActor
        },
        Extract<
          LiveSessionSupervisorEvent,
          {
            type: 'Session persisted' | 'Session failed'
          }
        >
      >(({ input, sendBack }) => {
        let settled = false
        let nativeId: string | null = null
        const subscription = input.session.subscribe((snapshot) => {
          if (snapshot.context.nativeId !== null && snapshot.context.nativeId !== nativeId) {
            nativeId = snapshot.context.nativeId
            bindSessionCommand(dependencies.database, snapshot.context.first.commandId, {
              nativeId,
            })
          }
          if (settled) return
          if (snapshot.context.argoId !== null) {
            settled = true
            bindSessionCommand(dependencies.database, snapshot.context.first.commandId, {
              sessionId: snapshot.context.argoId,
            })
            sendBack({
              type: 'Session persisted',
              pendingId: input.pendingId,
              commandId: snapshot.context.first.commandId,
              sessionId: snapshot.context.argoId,
            })
          } else if (snapshot.matches('Failed')) {
            settled = true
            sendBack({
              type: 'Session failed',
              pendingId: input.pendingId,
              commandId: snapshot.context.first.commandId,
              failure: snapshot.context.failure ?? 'Session start failed.',
              nativeId: snapshot.context.nativeId,
            })
          }
        })
        return () => subscription.unsubscribe()
      }),
      replyWhenPersisted: fromCallback<
        {
          type: 'Stop'
        },
        {
          session: LiveSessionActor
          reply: StartReply
        }
      >(({ input }) => {
        let settled = false
        const subscription = input.session.subscribe((snapshot) => {
          if (settled) return
          if (snapshot.context.argoId !== null) {
            settled = true
            input.reply.resolve({
              sessionId: snapshot.context.argoId,
            })
          } else if (snapshot.matches('Failed')) {
            settled = true
            input.reply.reject(startFailure(snapshot.context))
          }
        })
        return () => {
          subscription.unsubscribe()
          if (!settled) input.reply.reject(new Error('Session supervisor is closed.'))
        }
      }),
    },
    actions: {
      startOrQueue: assign({
        starts: ({ context, event, self, spawn }) => {
          if (event.type !== 'Start' && event.type !== 'Send') return context.starts
          if (
            handledStart({
              context,
              event,
              self,
              observeReply: (session, reply) => {
                spawn('replyWhenPersisted', {
                  input: {
                    session,
                    reply,
                  },
                })
              },
              commands,
            })
          )
            return context.starts
          const pendingId = pendingIdOf(event)
          if (!reserveOpeningCommand(event, commands)) return context.starts
          const harness = selectHarness({
            input: event.input,
            dependencies,
            commands,
          })
          const actorId = `live-session:${randomUUID()}`
          const actor = spawn(
            liveSessionMachine.provide({
              actors: {
                harness,
                persist: fromPromise(({ input: record }) => {
                  if (record.nativeId === null)
                    throw new Error('Session has no native ID to persist.')
                  if (record.sessionId !== undefined) {
                    // A resumed Session nothing names takes its title from this prompt at once.
                    const { database, changes } = dependencies
                    const { sessionId, firstPrompt } = record
                    if (saveFirstPromptOfUntitled(database, sessionId, firstPrompt))
                      changes?.changed([
                        sessionId,
                      ])
                    return Promise.resolve(sessionId)
                  }
                  if (record.projectId === null)
                    throw new Error('New Session has no Project to persist.')
                  const { worktree, ...saved } = record
                  return Promise.resolve(
                    createSessionUpsert(dependencies.database)({
                      ...saved,
                      nativeId: record.nativeId,
                      ...sessionWorktreeColumns(worktree),
                    }),
                  )
                }),
              },
            }),
            {
              input: event.input,
              systemId: actorId,
            },
          )
          spawn('observeSession', {
            input: {
              pendingId,
              session: actor,
            },
          })
          spawn('observeIdle', {
            id: `idle:${actorId}`,
            input: {
              actorId,
              session: actor,
            },
          })
          const stop = recordLiveSessionEvents(actor, dependencies.journal, {
            database: dependencies.database,
            changes: dependencies.changes,
          })
          spawn('observeLiveEvents', {
            id: `events:${actorId}`,
            input: {
              session: actor,
              stop,
            },
          })
          spawn('replyWhenPersisted', {
            input: {
              session: actor,
              reply: event.reply,
            },
          })
          return {
            ...context.starts,
            [pendingId]: actorId,
          }
        },
      }),
      rememberPersisted: assign({
        sessions: ({ context, event }) => {
          if (event.type !== 'Session persisted') return context.sessions
          const actorId = context.starts[event.pendingId]
          return actorId === undefined
            ? context.sessions
            : {
                ...context.sessions,
                [event.sessionId]: actorId,
              }
        },
        starts: ({ context, event }) => {
          if (event.type !== 'Session persisted' && event.type !== 'Session failed')
            return context.starts
          const { [event.pendingId]: _session, ...remaining } = context.starts
          return remaining
        },
        completed: ({ context, event }) => {
          if (event.type === 'Session persisted')
            return {
              ...context.completed,
              [event.pendingId]: {
                commandId: event.commandId,
                sessionId: event.sessionId,
              },
            }
          if (event.type === 'Session failed' && startReachedHarness(event.nativeId))
            return {
              ...context.completed,
              [event.pendingId]: {
                commandId: event.commandId,
                failure: event.failure,
              },
            }
          return context.completed
        },
      }),
      stopFailedSession: enqueueActions(({ context, event, self, enqueue }) => {
        if (event.type !== 'Session failed') return
        const actor = sessionActor(self, context.starts[event.pendingId])
        if (actor !== undefined) enqueue(stopChild(actor))
      }),
      retireIdleSession: enqueueActions(({ context, event, self, enqueue }) => {
        if (event.type !== 'Retire session') return
        if (context.sessions[event.sessionId] !== event.actorId) return
        const actor = sessionActor(self, event.actorId)
        if (actor === undefined || !actor.getSnapshot().matches('Ready')) return
        if (actor.getSnapshot().context.queue.length > 0) return
        const sessionId = event.sessionId
        enqueue(
          assign({
            sessions: ({ context: current }) => {
              const { [sessionId]: _retired, ...remaining } = current.sessions
              return remaining
            },
            completed: ({ context: current }) => {
              const { [`resume:${sessionId}`]: _retired, ...remaining } = current.completed
              return remaining
            },
          }),
        )
        enqueue(stopChild(actor))
        enqueue(stopChild(`idle:${event.actorId}`))
        enqueue(stopChild(`events:${event.actorId}`))
        enqueue.emit({
          type: 'Session status changed',
          sessionId,
        })
      }),
      retireFailedSession: enqueueActions(({ context, event, self, enqueue }) => {
        if (event.type !== 'Send') return
        const actor = sessionActor(self, context.sessions[event.input.sessionId])
        if (actor === undefined) return
        if (sessionIsUnavailable(actor)) enqueue(stopChild(actor))
      }),
      forwardSend: ({ context, event, self }) => {
        if (event.type !== 'Send') return
        const actor = sessionActor(self, context.sessions[event.input.sessionId])
        if (actor === undefined) return
        if (sessionIsUnavailable(actor)) return
        const catalog = self.system.get('catalog') as
          | ActorRefFrom<typeof harnessCatalogMachine>
          | undefined
        const error = sendValidationError(actor, event.input, {
          catalog,
          registry: dependencies.registry,
        })
        if (error !== null) {
          event.reply.reject(error)
          return
        }
        if (!reserveActiveCommand(event, commands)) return
        actor.send({
          type: 'Send',
          command: event.input,
        })
        event.reply.resolve({
          sessionId: event.input.sessionId,
        })
      },
      forwardInterrupt: ({ context, event, self }) => {
        if (event.type !== 'Interrupt') return
        const actor = sessionActor(self, context.sessions[event.sessionId])
        if (actor === undefined) {
          event.reply.reject(new Error('Session is not active.'))
          return
        }
        actor.send({
          type: 'Interrupt',
          reply: event.reply,
        })
      },
      forwardAnswer: ({ context, event, self }) => {
        if (event.type !== 'Answer permission' && event.type !== 'Answer question') return
        const actor = sessionActor(self, context.sessions[event.sessionId])
        if (actor === undefined) {
          event.reply.resolve(false)
          return
        }
        if (event.type === 'Answer permission')
          actor.send({
            type: 'Answer permission',
            requestId: event.requestId,
            decision: event.decision,
            reply: event.reply,
          })
        else
          actor.send({
            type: 'Answer question',
            requestId: event.requestId,
            answers: event.answers,
            reply: event.reply,
          })
      },
      bindCommand: ({ event }) => {
        if (event.type === 'Session persisted') commands.bind(event.commandId, event.sessionId)
      },
      announceStatus: emit(({ event }) => {
        if (event.type !== 'Session persisted' && event.type !== 'Session status changed')
          throw new Error('Expected a Session status change.')
        return {
          type: 'Session status changed' as const,
          sessionId: event.sessionId,
        }
      }),
      settleFailedCommand: ({ event }) => {
        if (event.type !== 'Session failed') return
        if (startReachedHarness(event.nativeId))
          return commands.record(event.commandId, 'uncertain')
        console.warn(`Harness failed before it accepted the Session start: ${event.failure}`)
        commands.release(event.commandId)
      },
    },
  }).createMachine({
    id: 'liveSessionSupervisor',
    initial: 'Running',
    context: () => ({
      sessions: {},
      starts: {},
      completed: {},
    }),
    states: {
      Running: {},
      Closed: {
        type: 'final',
      },
    },
    on: {
      Start: {
        actions: 'startOrQueue',
      },
      Send: {
        actions: [
          'retireFailedSession',
          'startOrQueue',
          'forwardSend',
        ],
      },
      Interrupt: {
        actions: 'forwardInterrupt',
      },
      'Answer permission': {
        actions: 'forwardAnswer',
      },
      'Answer question': {
        actions: 'forwardAnswer',
      },
      'Session persisted': {
        actions: [
          'rememberPersisted',
          'bindCommand',
          'announceStatus',
        ],
      },
      'Session status changed': {
        actions: 'announceStatus',
      },
      'Session failed': {
        actions: [
          'stopFailedSession',
          'rememberPersisted',
          'settleFailedCommand',
        ],
      },
      'Retire session': {
        actions: 'retireIdleSession',
      },
      Shutdown: '.Closed',
    },
  })
}

export type LiveSessionSupervisorActor = ActorRefFrom<
  ReturnType<typeof createLiveSessionSupervisorMachine>
>
