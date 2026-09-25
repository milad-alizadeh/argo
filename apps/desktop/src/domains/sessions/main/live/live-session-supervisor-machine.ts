import { type ActorRefFrom, assign, fromCallback, fromPromise, setup as xstateSetup } from 'xstate'
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
import type { SessionSendInput, SessionStartInput } from '../api/session-start'
import { createSessionUpsert } from '../database/session-upsert'
import { liveSessionMachine } from './live-session-machine'

type LiveSessionActor = ActorRefFrom<typeof liveSessionMachine>
type StartReply = {
  resolve: (value: { sessionId: string }) => void
  reject: (error: Error) => void
}
type LiveSessionSupervisorInput = {
  database: Database
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
      sessionId: string
    }
  | {
      type: 'Session failed'
      pendingId: string
      failure: string
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
  if (actor.getSnapshot().context.first.harness === 'claude')
    return (
      opening.model === turnConfiguration.model &&
      opening.effort === turnConfiguration.effort &&
      opening.mode === turnConfiguration.mode
    )
  return opening.mode === turnConfiguration.mode
}

export const liveSessionSupervisorMachine = xstateSetup({
  types: {
    input: {} as LiveSessionSupervisorInput,
    context: {} as {
      database: Database
      sessions: Record<string, LiveSessionActor>
      starts: Record<string, LiveSessionActor>
      completed: Record<
        string,
        | {
            sessionId: string
          }
        | {
            failure: string
          }
      >
      failed: Record<string, LiveSessionActor>
    },
    events: {} as LiveSessionSupervisorEvent,
  },
  actors: {
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
            sessionId: snapshot.context.argoId,
          })
        } else if (snapshot.matches('Failed')) {
          settled = true
          sendBack({
            type: 'Session failed',
            pendingId: input.pendingId,
            failure: snapshot.context.failure ?? 'Session start failed.',
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
        if (event.type !== 'Start') return context.starts
        const catalog = self.system.get('catalog') as
          | ActorRefFrom<typeof harnessCatalogMachine>
          | undefined
        if (
          !turnConfigurationIsAvailable(catalog, event.input.harness, event.input.turnConfiguration)
        ) {
          event.reply.reject(new Error('The selected Turn configuration is no longer available.'))
          return context.starts
        }
        const completed = context.completed[event.pendingId]
        if (completed !== undefined) {
          if ('sessionId' in completed) event.reply.resolve(completed)
          else event.reply.reject(new Error(completed.failure))
          return context.starts
        }
        const existing = context.starts[event.pendingId]
        if (existing !== undefined) {
          if (existing.getSnapshot().context.first.commandId !== event.input.commandId)
            existing.send({
              type: 'Send',
              command: event.input,
            })
          spawn('replyWhenPersisted', {
            input: {
              session: existing,
              reply: event.reply,
            },
          })
          return context.starts
        }
        let harness: typeof claudeLiveSessionMachine | typeof codexLiveSessionMachine
        switch (event.input.harness) {
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
            const unknownHarness: never = event.input.harness
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
            input: event.input,
          },
        )
        spawn('observeSession', {
          input: {
            pendingId: event.pendingId,
            session: actor,
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
          [event.pendingId]: actor,
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
              sessionId: event.sessionId,
            },
          }
        if (event.type === 'Session failed')
          return {
            ...context.completed,
            [event.pendingId]: {
              failure: event.failure,
            },
          }
        return context.completed
      },
      failed: ({ context, event }) => {
        if (event.type !== 'Session failed') return context.failed
        const actor = context.starts[event.pendingId]
        return actor === undefined
          ? context.failed
          : {
              ...context.failed,
              [event.pendingId]: actor,
            }
      },
    }),
    forwardSend: ({ context, event, self }) => {
      if (event.type !== 'Send') return
      const actor = context.sessions[event.input.sessionId]
      if (actor === undefined) {
        event.reply.reject(new Error('Session is not live.'))
        return
      }
      if (
        !turnConfigurationIsAvailable(
          self.system.get('catalog') as ActorRefFrom<typeof harnessCatalogMachine> | undefined,
          actor.getSnapshot().context.first.harness,
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
    sessions: {},
    starts: {},
    completed: {},
    failed: {},
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
      actions: 'forwardSend',
    },
    'Session persisted': {
      actions: 'rememberPersisted',
    },
    'Session failed': {
      actions: 'rememberPersisted',
    },
    Shutdown: '.Closed',
  },
})

export type LiveSessionSupervisorActor = ActorRefFrom<typeof liveSessionSupervisorMachine>
