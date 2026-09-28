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
import type { harnessCatalogMachine } from '@/harnesses/catalog/harness-catalog-machine'
import {
  type claudeLiveSessionMachine,
  createClaudeLiveSessionMachine,
} from '@/harnesses/claude/session/claude-live-session-machine'
import {
  type codexAppServerMachine,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import {
  codexLiveSessionActors,
  codexLiveSessionMachine,
} from '@/harnesses/codex/session/codex-live-session-machine'
import type { SessionLiveInput, SessionSendInput, SessionStartInput } from '../api/session-submit'
import { createSessionUpsert } from '../database/session-upsert'
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
export class SessionSendRejectedError extends Error {}
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
}): boolean {
  if (event.type === 'Send' && context.sessions[event.input.sessionId] !== undefined) return true
  const pendingId = pendingIdOf(event)
  const catalog = self.system.get('catalog') as
    | ActorRefFrom<typeof harnessCatalogMachine>
    | undefined
  if (
    !turnConfigurationIsAvailable(catalog, harnessOf(event.input), event.input.turnConfiguration)
  ) {
    event.reply.reject(
      event.type === 'Send'
        ? new SessionSendRejectedError('The selected Turn configuration is no longer available.')
        : new Error('The selected Turn configuration is no longer available.'),
    )
    return true
  }
  if (replyForCompletedStart(context.completed[pendingId], event.input.commandId, event.reply))
    return true
  const existing = sessionActor(self, context.starts[pendingId])
  if (existing === undefined) return false
  if (existing.getSnapshot().context.first.commandId !== event.input.commandId)
    event.reply.reject(new Error('A conflicting start is already active for this draft.'))
  else observeReply(existing, event.reply)
  return true
}

export function createLiveSessionSupervisorMachine(dependencies: LiveSessionSupervisorInput) {
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
            })
          )
            return context.starts
          const pendingId = pendingIdOf(event)
          let harness: typeof claudeLiveSessionMachine | typeof codexLiveSessionMachine
          const harnessName = harnessOf(event.input)
          switch (harnessName) {
            case 'claude':
              harness = createClaudeLiveSessionMachine(dependencies.interactions)
              break
            case 'codex': {
              const codex = self.system.get('codex') as
                | ActorRefFrom<typeof codexAppServerMachine>
                | undefined
              if (codex === undefined) throw new Error('Codex app-server actor is unavailable.')
              harness = codexLiveSessionMachine.provide({
                actors: codexLiveSessionActors(requestCodexAppServer(codex)),
              })
              break
            }
            default: {
              const unknownHarness: never = harnessName
              throw new Error(`Unsupported Harness: ${unknownHarness}`)
            }
          }
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
      forwardSend: ({ context, event, self }) => {
        if (event.type !== 'Send') return
        const actor = sessionActor(self, context.sessions[event.input.sessionId])
        if (actor === undefined) return
        if (
          !turnConfigurationIsAvailable(
            self.system.get('catalog') as ActorRefFrom<typeof harnessCatalogMachine> | undefined,
            harnessOf(actor.getSnapshot().context.first),
            event.input.turnConfiguration,
          )
        ) {
          event.reply.reject(
            new SessionSendRejectedError('The selected Turn configuration is no longer available.'),
          )
          return
        }
        if (!acceptsTurnConfigurationChange(actor, event.input.turnConfiguration)) {
          event.reply.reject(
            new SessionSendRejectedError(
              'Changing this Turn configuration requires starting a new Session.',
            ),
          )
          return
        }
        const snapshot = actor.getSnapshot()
        if (snapshot.matches('Failed') || snapshot.matches('Closed')) {
          event.reply.reject(
            new SessionSendRejectedError(
              snapshot.context.failure ?? 'Session is not available for sends.',
            ),
          )
          return
        }
        actor.send({
          type: 'Send',
          command: event.input,
        })
        event.reply.resolve({
          sessionId: event.input.sessionId,
        })
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
          'startOrQueue',
          'forwardSend',
        ],
      },
      'Session persisted': {
        actions: 'rememberPersisted',
      },
      'Session failed': {
        actions: [
          'stopFailedSession',
          'rememberPersisted',
        ],
      },
      Shutdown: '.Closed',
    },
  })
}

export type LiveSessionSupervisorActor = ActorRefFrom<
  ReturnType<typeof createLiveSessionSupervisorMachine>
>
