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
import { claudeLiveSessionMachine } from '@/harnesses/claude/session/claude-live-session-machine'
import {
  type codexAppServerMachine,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import {
  codexLiveSessionActors,
  codexLiveSessionMachine,
} from '@/harnesses/codex/session/codex-live-session-machine'
import type { SessionLiveInput, SessionSendInput, SessionStartInput } from '../api/session-submit'
import type { SessionEventJournal } from '../database/session-event-journal'
import { createSessionUpsert } from '../database/session-upsert'
import { liveSessionMachine } from './live-session-machine'
import type { SessionInteractionBroker } from './session-interaction-broker'

type LiveSessionActor = ActorRefFrom<typeof liveSessionMachine>
export function recordLiveSessionEvents(
  session: LiveSessionActor,
  journal: SessionEventJournal,
): () => void {
  let lastSerial = 0
  let pending: {
    serial: number
    body: Parameters<SessionEventJournal['append']>[1]
  }[] = []
  const subscription = session.subscribe((snapshot) => {
    const next = snapshot.context.feedEvents.filter((event) => event.serial > lastSerial)
    if (next.length > 0) {
      lastSerial = next.at(-1)?.serial ?? lastSerial
      pending = [
        ...pending,
        ...next,
      ]
    }
    if (snapshot.context.argoId === null || pending.length === 0) return
    for (const event of pending) journal.append(snapshot.context.argoId, event.body)
    pending = []
  })
  return () => subscription.unsubscribe()
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

export const liveSessionSupervisorMachine = xstateSetup({
  types: {
    input: {} as LiveSessionSupervisorInput,
    context: {} as {
      database: Database
      journal: SessionEventJournal | undefined
      interactions: SessionInteractionBroker | undefined
      sessions: Record<string, LiveSessionActor>
      starts: Record<string, LiveSessionActor>
      completed: Record<
        string,
        | {
            commandId: string
            sessionId: string
          }
        | {
            commandId: string
            failure: string
          }
      >
    },
    events: {} as LiveSessionSupervisorEvent,
  },
  actors: {
    observeLiveEvents: fromCallback<
      {
        type: 'Stop'
      },
      {
        session: LiveSessionActor
        journal: SessionEventJournal
      }
    >(({ input }) => recordLiveSessionEvents(input.session, input.journal)),
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
        if (event.type === 'Send' && context.sessions[event.input.sessionId] !== undefined)
          return context.starts
        const pendingId = pendingIdOf(event)
        const catalog = self.system.get('catalog') as
          | ActorRefFrom<typeof harnessCatalogMachine>
          | undefined
        if (
          !turnConfigurationIsAvailable(
            catalog,
            harnessOf(event.input),
            event.input.turnConfiguration,
          )
        ) {
          event.reply.reject(new Error('The selected Turn configuration is no longer available.'))
          return context.starts
        }
        if (
          replyForCompletedStart(context.completed[pendingId], event.input.commandId, event.reply)
        )
          return context.starts
        const existing = context.starts[pendingId]
        if (existing !== undefined) {
          if (existing.getSnapshot().context.first.commandId !== event.input.commandId) {
            event.reply.reject(new Error('A conflicting start is already active for this draft.'))
            return context.starts
          }
          spawn('replyWhenPersisted', {
            input: {
              session: existing,
              reply: event.reply,
            },
          })
          return context.starts
        }
        let harness: typeof claudeLiveSessionMachine | typeof codexLiveSessionMachine
        const harnessName = harnessOf(event.input)
        switch (harnessName) {
          case 'claude':
            harness = claudeLiveSessionMachine
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
                  createSessionUpsert(context.database)({
                    ...record,
                    nativeId: record.nativeId,
                  }),
                )
              }),
            },
          }),
          {
            input: {
              ...event.input,
              interactions: context.interactions,
            },
          },
        )
        spawn('observeSession', {
          input: {
            pendingId,
            session: actor,
          },
        })
        if (context.journal !== undefined)
          spawn('observeLiveEvents', {
            input: {
              session: actor,
              journal: context.journal,
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
          [pendingId]: actor,
        }
      },
    }),
    rememberPersisted: assign({
      sessions: ({ context, event }) => {
        if (event.type !== 'Session persisted') return context.sessions
        const actor = context.starts[event.pendingId]
        return actor === undefined
          ? context.sessions
          : {
              ...context.sessions,
              [event.sessionId]: actor,
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
    stopFailedSession: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'Session failed') return
      const actor = context.starts[event.pendingId]
      if (actor !== undefined) enqueue(stopChild(actor))
    }),
    forwardSend: ({ context, event, self }) => {
      if (event.type !== 'Send') return
      const actor = context.sessions[event.input.sessionId]
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
  context: ({ input }) => ({
    database: input.database,
    journal: input.journal,
    interactions: input.interactions,
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

export type LiveSessionSupervisorActor = ActorRefFrom<typeof liveSessionSupervisorMachine>
