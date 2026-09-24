import { type ActorRefFrom, assign, fromPromise, setup, waitFor } from 'xstate'
import type { harnessCatalogMachine } from '@/harnesses/catalog/harness-catalog-machine'
import { claudeSessionMachine } from '@/harnesses/claude/session/claude-session-machine'
import {
  type codexAppServerMachine,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import {
  codexSessionActors,
  codexSessionMachine,
} from '@/harnesses/codex/session/codex-session-machine'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import type { SessionSendInput, SessionStartInput } from '../../contract/session-start'
import { createSessionUpsert } from '../storage/session-upsert'
import { sessionMachine } from './session-machine'

type SessionActor = ActorRefFrom<typeof sessionMachine>
type StartReply = {
  resolve: (value: { sessionId: string }) => void
  reject: (error: Error) => void
}
type SupervisorInput = {
  database: DurableDatabase
}
type SupervisorEvent =
  | {
      type: 'Start'
      input: SessionStartInput
      reply: StartReply
    }
  | {
      type: 'Send'
      input: SessionSendInput
      reply: StartReply
    }
  | {
      type: 'Started'
      commandId: string
      sessionId: string
    }
  | {
      type: 'Start failed'
      commandId: string
      error: Error
    }
  | {
      type: 'Shutdown'
    }

export const sessionSupervisorMachine = setup({
  types: {
    input: {} as SupervisorInput,
    context: {} as {
      services: SupervisorInput
      sessions: Record<string, SessionActor>
      starts: Record<
        string,
        {
          actor: SessionActor
          replies: StartReply[]
        }
      >
      completed: Record<
        string,
        | {
            sessionId: string
          }
        | {
            error: Error
          }
      >
      failed: Record<string, SessionActor>
    },
    events: {} as SupervisorEvent,
  },
  guards: {
    isCompletedStart: ({ context, event }) =>
      event.type === 'Start' && context.completed[event.input.commandId] !== undefined,
  },
  actions: {
    replyToCompletedStart: ({ context, event }) => {
      if (event.type !== 'Start') return
      const completed = context.completed[event.input.commandId]
      if (completed === undefined) return
      if ('error' in completed) event.reply.reject(completed.error)
      else event.reply.resolve(completed)
    },
    rejectPendingOnShutdown: ({ context }) => {
      for (const pending of Object.values(context.starts))
        for (const reply of pending.replies)
          reply.reject(new Error('Session supervisor is closed.'))
    },
    rememberStart: assign({
      starts: ({ context, event, spawn, self }) => {
        if (event.type !== 'Start') return context.starts
        const catalogActor = self.system.get('catalog') as
          | ActorRefFrom<typeof harnessCatalogMachine>
          | undefined
        const catalog = catalogActor
          ?.getSnapshot()
          .context.catalog.harnesses.find(
            (candidate) =>
              candidate.harness === event.input.harness && candidate.availability === 'available',
          )
        const model =
          catalog?.availability === 'available'
            ? catalog.models.find((candidate) => candidate.value === event.input.setup.model)
            : undefined
        if (
          catalog?.availability !== 'available' ||
          !model?.efforts.includes(event.input.setup.effort) ||
          !catalog.modes.some((mode) => mode.value === event.input.setup.mode)
        ) {
          event.reply.reject(new Error('The selected Session setup is no longer available.'))
          return context.starts
        }
        const pending = context.starts[event.input.commandId]
        if (pending !== undefined)
          return {
            ...context.starts,
            [event.input.commandId]: {
              ...pending,
              replies: [
                ...pending.replies,
                event.reply,
              ],
            },
          }
        let harness: typeof claudeSessionMachine | typeof codexSessionMachine
        switch (event.input.harness) {
          case 'claude':
            harness = claudeSessionMachine
            break
          case 'codex': {
            const codexActor = self.system.get('codex') as
              | ActorRefFrom<typeof codexAppServerMachine>
              | undefined
            if (codexActor === undefined) throw new Error('Codex app-server actor is unavailable.')
            harness = codexSessionMachine.provide({
              actors: codexSessionActors(requestCodexAppServer(codexActor)),
            })
            break
          }
          default: {
            const unknownHarness: never = event.input.harness
            throw new Error(`Unsupported Harness: ${unknownHarness}`)
          }
        }
        const machine = sessionMachine.provide({
          actors: {
            harness,
            persist: fromPromise(({ input: record }) => {
              if (record.nativeId === null) throw new Error('Session has no native ID to persist.')
              return Promise.resolve(
                createSessionUpsert(context.services.database)({
                  ...record,
                  nativeId: record.nativeId,
                }),
              )
            }),
          },
        })
        const actor = spawn(machine, {
          input: event.input,
        })
        return {
          ...context.starts,
          [event.input.commandId]: {
            actor,
            replies: [
              event.reply,
            ],
          },
        }
      },
    }),
    awaitStart: ({ context, event, self }) => {
      if (event.type !== 'Start') return
      const pending = context.starts[event.input.commandId]
      if (pending === undefined || pending.replies.length !== 1) return
      void waitFor(
        pending.actor,
        (snapshot) => snapshot.matches('Ready') || snapshot.matches('Failed'),
      ).then(
        (snapshot) => {
          if (snapshot.matches('Failed'))
            self.send({
              type: 'Start failed',
              commandId: event.input.commandId,
              error: new Error(snapshot.context.failure ?? 'Session start failed.'),
            })
          else if (snapshot.context.argoId !== null)
            self.send({
              type: 'Started',
              commandId: event.input.commandId,
              sessionId: snapshot.context.argoId,
            })
          else
            self.send({
              type: 'Start failed',
              commandId: event.input.commandId,
              error: new Error('Session identity did not persist.'),
            })
        },
        (error) =>
          self.send({
            type: 'Start failed',
            commandId: event.input.commandId,
            error: new Error(String(error)),
          }),
      )
    },
    finishStart: ({ context, event }) => {
      if (event.type !== 'Started') return
      for (const reply of context.starts[event.commandId]?.replies ?? [])
        reply.resolve({
          sessionId: event.sessionId,
        })
    },
    failStart: ({ context, event }) => {
      if (event.type !== 'Start failed') return
      for (const reply of context.starts[event.commandId]?.replies ?? []) reply.reject(event.error)
    },
    rememberResult: assign({
      completed: ({ context, event }) => {
        switch (event.type) {
          case 'Started':
            return {
              ...context.completed,
              [event.commandId]: {
                sessionId: event.sessionId,
              },
            }
          case 'Start failed':
            return {
              ...context.completed,
              [event.commandId]: {
                error: event.error,
              },
            }
          default:
            return context.completed
        }
      },
      sessions: ({ context, event }) => {
        if (event.type !== 'Started') return context.sessions
        const actor = context.starts[event.commandId]?.actor
        return actor === undefined
          ? context.sessions
          : {
              ...context.sessions,
              [event.sessionId]: actor,
            }
      },
      failed: ({ context, event }) => {
        if (event.type !== 'Start failed') return context.failed
        const actor = context.starts[event.commandId]?.actor
        return actor === undefined
          ? context.failed
          : {
              ...context.failed,
              [event.commandId]: actor,
            }
      },
      starts: ({ context, event }) => {
        if (event.type !== 'Started' && event.type !== 'Start failed') return context.starts
        const { [event.commandId]: _finished, ...remaining } = context.starts
        return remaining
      },
    }),
    forwardSend: ({ context, event, self }) => {
      if (event.type !== 'Send') return
      const actor = context.sessions[event.input.sessionId]
      if (actor === undefined) {
        event.reply.reject(new Error('Session is not live.'))
        return
      }
      const snapshot = actor.getSnapshot()
      if (snapshot.matches('Failed') || snapshot.matches('Closed')) {
        event.reply.reject(
          new Error(snapshot.context.failure ?? 'Session is not available for sends.'),
        )
        return
      }
      const catalogActor = self.system.get('catalog') as
        | ActorRefFrom<typeof harnessCatalogMachine>
        | undefined
      const catalog = catalogActor
        ?.getSnapshot()
        .context.catalog.harnesses.find(
          (candidate) =>
            candidate.harness === snapshot.context.first.harness &&
            candidate.availability === 'available',
        )
      if (catalog?.availability !== 'available') {
        event.reply.reject(new Error('The selected Session setup is no longer available.'))
        return
      }
      const model = catalog?.models.find((candidate) => candidate.value === event.input.setup.model)
      if (
        !model?.efforts.includes(event.input.setup.effort) ||
        !catalog?.modes.some((mode) => mode.value === event.input.setup.mode)
      ) {
        event.reply.reject(new Error('The selected Session setup is no longer available.'))
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
  id: 'sessionSupervisor',
  initial: 'Idle',
  context: ({ input }) => ({
    services: input,
    sessions: {},
    starts: {},
    completed: {},
    failed: {},
  }),
  states: {
    Idle: {
      on: {
        Started: {
          target: 'Running',
          actions: [
            'finishStart',
            'rememberResult',
          ],
        },
      },
    },
    Running: {
      on: {
        Started: {
          actions: [
            'finishStart',
            'rememberResult',
          ],
        },
      },
    },
    Closed: {
      type: 'final',
    },
  },
  on: {
    Start: [
      {
        guard: 'isCompletedStart',
        actions: 'replyToCompletedStart',
      },
      {
        actions: [
          'rememberStart',
          'awaitStart',
        ],
      },
    ],
    Send: {
      actions: 'forwardSend',
    },
    'Start failed': {
      actions: [
        'failStart',
        'rememberResult',
      ],
    },
    Shutdown: {
      target: '.Closed',
      actions: 'rejectPendingOnShutdown',
    },
  },
})

export type SessionSupervisorActor = ActorRefFrom<typeof sessionSupervisorMachine>
