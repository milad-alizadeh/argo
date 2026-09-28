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
  observeCodexAppServer,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import {
  codexLiveSessionActors,
  codexLiveSessionMachine,
} from '@/harnesses/codex/session/codex-live-session-machine'
import type { SessionLiveInput, SessionSendInput, SessionStartInput } from '../api/session-submit'
import {
  bindSessionCommand,
  claimSessionCommand,
  setSessionCommandOutcome,
} from '../database/session-command-outcomes'
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
  journal?: SessionEventJournal,
  database?: Database,
): () => void {
  let sessionId: string | null = null
  let inFlightCommandId: string | null = session.getSnapshot().context.first.commandId
  const eventSubscription = session.on('feed', ({ body }) => {
    if (database !== undefined && body.commandId !== null) {
      if (body.turnId !== null)
        bindSessionCommand(database, body.commandId, { turnId: body.turnId })
      if (body.type === 'failure') setSessionCommandOutcome(database, body.commandId, 'unknown')
      else if (body.type === 'status' && body.status === 'idle')
        setSessionCommandOutcome(database, body.commandId, 'completed')
      else if (body.type === 'status' && body.status === 'unknown')
        setSessionCommandOutcome(database, body.commandId, 'unknown')
      else if (
        (body.type === 'status' && body.status === 'running') ||
        (body.type === 'content' &&
          body.content.kind === 'message' &&
          body.content.role === 'user')
      )
        setSessionCommandOutcome(database, body.commandId, 'observed')
    }
    if (sessionId === null) journal?.stage(session, body)
    else journal?.append(sessionId, body)
  })
  const subscription = session.subscribe((snapshot) => {
    if (database !== undefined) {
      if (snapshot.matches('Sending')) {
        const nextCommandId = snapshot.context.queue[0]?.commandId
        if (nextCommandId !== undefined && nextCommandId !== inFlightCommandId) {
          if (inFlightCommandId !== null)
            setSessionCommandOutcome(database, inFlightCommandId, 'accepted')
          inFlightCommandId = nextCommandId
        }
      } else if (snapshot.matches('Ready') && inFlightCommandId !== null) {
        setSessionCommandOutcome(database, inFlightCommandId, 'accepted')
        inFlightCommandId = null
      } else if (snapshot.matches('Failed') && inFlightCommandId !== null) {
        setSessionCommandOutcome(database, inFlightCommandId, 'unknown')
        inFlightCommandId = null
      }
    }
    if (sessionId !== null || snapshot.context.argoId === null) return
    sessionId = snapshot.context.argoId
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
  const feed = session.on('feed', ({ body }) => {
    if (body.type !== 'status') return
    clear()
    if (body.status !== 'idle') return
    timer = setTimeout(() => {
      const sessionId = session.getSnapshot().context.argoId
      if (sessionId !== null) retire(sessionId)
    }, milliseconds)
  })
  const state = session.subscribe((snapshot) => {
    if (snapshot.matches('Failed') || snapshot.matches('Closed')) clear()
  })
  return () => {
    clear()
    feed.unsubscribe()
    state.unsubscribe()
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
    event.reply.reject(new Error('The selected Turn configuration is no longer available.'))
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
      observeIdle: fromCallback<
        { type: 'Stop' },
        { actorId: string; session: LiveSessionActor },
        Extract<LiveSessionSupervisorEvent, { type: 'Retire session' }>
      >(({ input, sendBack }) => {
        return watchIdleSession(
          input.session,
          5 * 60_000,
          (sessionId) =>
            sendBack({ type: 'Retire session', actorId: input.actorId, sessionId }),
        )
      }),
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
        let nativeId: string | null = null
        const subscription = input.session.subscribe((snapshot) => {
          if (snapshot.context.nativeId !== null && snapshot.context.nativeId !== nativeId) {
            nativeId = snapshot.context.nativeId
            bindSessionCommand(dependencies.database, snapshot.context.first.commandId, { nativeId })
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
                actors: codexLiveSessionActors(
                  requestCodexAppServer(codex),
                  (listener) => observeCodexAppServer(codex, listener),
                ),
              })
              break
            }
            default: {
              const unknownHarness: never = harnessName
              throw new Error(`Unsupported Harness: ${unknownHarness}`)
            }
          }
          try {
            const claim = claimSessionCommand(dependencies.database, {
              commandId: event.input.commandId,
              intentId: event.type === 'Start' ? event.pendingId : event.intentId,
              sessionId: event.type === 'Send' ? event.input.sessionId : null,
              harness: harnessName,
              nativeId: event.type === 'Send' ? event.input.resume.nativeId : null,
              cwd: event.type === 'Send' ? event.input.resume.cwd : event.input.cwd,
            })
            if (!claim.claimed) {
              if (claim.sessionId === null)
                event.reply.reject(new Error('The previous Session start is still unresolved.'))
              else event.reply.resolve({ sessionId: claim.sessionId })
              return context.starts
            }
          } catch (error) {
            event.reply.reject(error instanceof Error ? error : new Error(String(error)))
            return context.starts
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
          spawn('observeIdle', {
            id: `idle:${actorId}`,
            input: { actorId, session: actor },
          })
          const stop = recordLiveSessionEvents(actor, dependencies.journal, dependencies.database)
          spawn('observeLiveEvents', {
            id: `events:${actorId}`,
            input: { stop },
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
        setSessionCommandOutcome(dependencies.database, event.commandId, 'unknown')
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
          event.reply.reject(new Error('The selected Turn configuration is no longer available.'))
          return
        }
        if (!acceptsTurnConfigurationChange(actor, event.input.turnConfiguration)) {
          event.reply.reject(
            new Error('Changing this Turn configuration requires starting a new Session.'),
          )
          return
        }
        const snapshot = actor.getSnapshot()
        if (snapshot.matches('Failed') || snapshot.matches('Closed')) {
          event.reply.reject(
            new Error(snapshot.context.failure ?? 'Session is not available for sends.'),
          )
          return
        }
        try {
          const claim = claimSessionCommand(dependencies.database, {
            commandId: event.input.commandId,
            intentId: event.intentId,
            sessionId: event.input.sessionId,
            harness: event.input.resume.harness,
            nativeId: event.input.resume.nativeId,
            cwd: event.input.resume.cwd,
          })
          if (!claim.claimed) {
            event.reply.resolve({ sessionId: event.input.sessionId })
            return
          }
        } catch (error) {
          event.reply.reject(error instanceof Error ? error : new Error(String(error)))
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
