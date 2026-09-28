import { randomUUID } from 'node:crypto'
import {
  type ActorRefFrom,
  assign,
  enqueueActions,
  fromCallback,
  fromPromise,
  stopChild,
  setup as xstateSetup,
} from 'xstate'
import type { Database } from '@/database/database'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import type { harnessCatalogMachine } from '@/harnesses/catalog/harness-catalog-machine'
import {
  type codexAppServerMachine,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import {
  codexLiveSessionActors,
  codexLiveSessionMachine,
} from '@/harnesses/codex/session/codex-live-session-machine'
import type { HarnessRegistry } from '@/harnesses/registry'
import type { SessionLiveInput, SessionSendInput, SessionStartInput } from '../api/session-submit'
import {
  createSessionCommandStore,
  type SessionCommandStore,
} from '../database/session-command-store'
import { createSessionUpsert } from '../database/session-upsert'
import { liveSessionChannelActor } from './live-session-channel-actor'
import { liveSessionMachine } from './live-session-machine'
import type { SessionEventJournal } from './session-event-journal'
import type { SessionInteractionBroker } from './session-interaction-broker'

type LiveSessionActor = ActorRefFrom<typeof liveSessionMachine>
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

export function liveSessionActorFor(supervisor: LiveSessionSupervisorActor, sessionId: string) {
  const { sessions, starts } = supervisor.getSnapshot().context
  const persisted = sessionActor(supervisor, sessions[sessionId])
  if (persisted !== undefined) return persisted
  return Object.values(starts ?? {})
    .map((id) => sessionActor(supervisor, id))
    .find((actor) => actor?.getSnapshot().context.argoId === sessionId)
}
export function recordLiveSessionEvents(
  session: LiveSessionActor,
  journal: SessionEventJournal,
): () => void {
  let sessionId: string | null = null
  const eventSubscription = session.on('feed', ({ body }) => {
    if (sessionId === null) journal.stage(session, body)
    else journal.append(sessionId, body)
  })
  const subscription = session.subscribe((snapshot) => {
    if (sessionId !== null || snapshot.context.argoId === null) return
    sessionId = snapshot.context.argoId
    journal.bind(session, sessionId)
  })
  return () => {
    subscription.unsubscribe()
    eventSubscription.unsubscribe()
    journal.discard(session)
  }
}
type StartReply = {
  resolve: (value: { sessionId: string }) => void
  reject: (error: Error) => void
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
  return Boolean(
    model?.efforts.includes(turnConfiguration.effort) &&
      entry.modes.some((mode) => mode.value === turnConfiguration.mode) &&
      (model.supportedModes === undefined || model.supportedModes.includes(turnConfiguration.mode)),
  )
}

function acceptsTurnConfigurationChange(
  actor: LiveSessionActor,
  turnConfiguration: SessionSendInput['turnConfiguration'],
): boolean {
  const opening = actor.getSnapshot().context.first.turnConfiguration
  if (harnessOf(actor.getSnapshot().context.first) === 'claude')
    return (
      opening.model === turnConfiguration.model &&
      opening.effort === turnConfiguration.effort &&
      opening.mode === turnConfiguration.mode
    )
  return opening.mode === turnConfiguration.mode
}

function harnessOf(input: SessionLiveInput) {
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
    !turnConfigurationIsAvailable(catalog, harnessOf(event.input), event.input.turnConfiguration)
  ) {
    event.reply.reject(new Error('The selected Turn configuration is no longer available.'))
    return true
  }
  const staleClaudeSession =
    event.type === 'Send' &&
    harnessOf(event.input) === 'claude' &&
    context.sessions[event.input.sessionId] !== undefined
  if (
    !staleClaudeSession &&
    replyForCompletedStart(context.completed[pendingId], event.input.commandId, event.reply)
  )
    return true
  const existing = sessionActor(self, context.starts[pendingId])
  if (existing === undefined) return false
  if (existing.getSnapshot().context.first.commandId === event.input.commandId)
    observeReply(existing, event.reply)
  else if (event.type === 'Send') {
    if (harnessOf(event.input) !== 'claude' || reserveActiveCommand(event, commands)) {
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
  if (harnessOf(event.input) !== 'claude') return true
  const outcome = commands.reserve(
    event.input.commandId,
    event.type === 'Send' ? event.input.sessionId : null,
  )
  if (outcome.reserved) return true
  if (outcome.sessionId !== null)
    event.reply.resolve({
      sessionId: outcome.sessionId,
    })
  else event.reply.reject(new Error('Claude send outcome is uncertain.'))
  return false
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
  const outcome = commands.reserve(event.input.commandId, event.input.sessionId)
  if (outcome.reserved) return true
  event.reply.resolve({
    sessionId: event.input.sessionId,
  })
  return false
}

function selectHarness({
  input,
  self,
  dependencies,
  commands,
}: {
  input: SessionLiveInput
  self: {
    system: LiveSessionSupervisorActor['system']
  }
  dependencies: LiveSessionSupervisorInput
  commands: SessionCommandStore
}) {
  switch (harnessOf(input)) {
    case 'claude': {
      const open = dependencies.registry.claude.openLiveSession
      if (open === undefined) throw new Error('Claude live channel is unavailable.')
      return liveSessionChannelActor(open, dependencies.interactions, commands)
    }
    case 'codex': {
      const codex = self.system.get('codex') as
        | ActorRefFrom<typeof codexAppServerMachine>
        | undefined
      if (codex === undefined) throw new Error('Codex app-server actor is unavailable.')
      return codexLiveSessionMachine.provide({
        actors: codexLiveSessionActors(requestCodexAppServer(codex)),
      })
    }
  }
}

function sendValidationError(
  actor: LiveSessionActor,
  input: SessionSendInput,
  catalog: ActorRefFrom<typeof harnessCatalogMachine> | undefined,
): Error | null {
  if (
    !turnConfigurationIsAvailable(
      catalog,
      harnessOf(actor.getSnapshot().context.first),
      input.turnConfiguration,
    )
  )
    return new Error('The selected Turn configuration is no longer available.')
  if (!acceptsTurnConfigurationChange(actor, input.turnConfiguration))
    return new Error('Changing this Turn configuration requires starting a new Session.')
  const snapshot = actor.getSnapshot()
  if (sessionIsUnavailable(actor))
    return new Error(snapshot.context.failure ?? 'Session is not available for sends.')
  return null
}

export function createLiveSessionSupervisorMachine(dependencies: LiveSessionSupervisorInput) {
  const commands = createSessionCommandStore(dependencies.database)
  return xstateSetup({
    types: {
      context: {} as SupervisorContext,
      events: {} as LiveSessionSupervisorEvent,
    },
    actors: {
      observeLiveEvents: fromCallback<
        {
          type: 'Stop'
        },
        {
          stop: () => void
        }
      >(({ input }) => input.stop),
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
        const subscription = input.session.subscribe((snapshot) => {
          if (settled) return
          if (snapshot.context.argoId !== null) {
            settled = true
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
            input.reply.reject(new Error(snapshot.context.failure ?? 'Session start failed.'))
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
            self,
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
                  if (record.sessionId !== undefined) return Promise.resolve(record.sessionId)
                  if (record.projectId === null || record.workspaceId === null)
                    throw new Error('New Session has no Project Workspace to persist.')
                  return Promise.resolve(
                    createSessionUpsert(dependencies.database)({
                      ...record,
                      nativeId: record.nativeId,
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
          if (dependencies.journal !== undefined) {
            const stop = recordLiveSessionEvents(actor, dependencies.journal)
            spawn('observeLiveEvents', {
              input: {
                stop,
              },
            })
          }
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
          if (event.type === 'Session failed' && event.nativeId !== null)
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
        const error = sendValidationError(actor, event.input, catalog)
        if (error !== null) {
          event.reply.reject(error)
          return
        }
        if (
          harnessOf(actor.getSnapshot().context.first) === 'claude' &&
          !reserveActiveCommand(event, commands)
        )
          return
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
        if (actor === undefined || harnessOf(actor.getSnapshot().context.first) !== 'claude') {
          event.reply.reject(new Error('Claude Session is not active.'))
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
        if (actor === undefined || harnessOf(actor.getSnapshot().context.first) !== 'claude') {
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
      markUncertain: ({ event }) => {
        if (event.type === 'Session failed' && event.nativeId !== null)
          commands.record(event.commandId, 'uncertain')
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
        ],
      },
      'Session failed': {
        actions: [
          'stopFailedSession',
          'rememberPersisted',
          'markUncertain',
        ],
      },
      Shutdown: '.Closed',
    },
  })
}

export type LiveSessionSupervisorActor = ActorRefFrom<
  ReturnType<typeof createLiveSessionSupervisorMachine>
>
