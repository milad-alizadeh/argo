import { type ActorRefFrom, assign, fromCallback, fromPromise, setup } from 'xstate'
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
import type {
  ExistingSessionInput,
  SessionSendInput,
  SessionStartInput,
} from '../../contract/session-start'
import { readSessionIdentity, type SessionIdentity } from '../storage/session-records'
import { upsertSession } from '../storage/session-upsert'
import type { sessionSyncMachine } from '../sync/session-sync-machine'
import { type SessionPersistInput, sessionMachine } from './session-machine'

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

function setupIsAvailable(
  catalog: ActorRefFrom<typeof harnessCatalogMachine> | undefined,
  harness: SessionStartInput['harness'],
  setup: SessionStartInput['setup'],
) {
  const entry = catalog
    ?.getSnapshot()
    .context.catalog.harnesses.find(
      (candidate) => candidate.harness === harness && candidate.availability === 'available',
    )
  if (entry?.availability !== 'available') return false
  const model = entry.models.find((candidate) => candidate.value === setup.model)
  return Boolean(
    model?.efforts.includes(setup.effort) &&
      entry.modes.some((mode) => mode.value === setup.mode) &&
      (model.supportedModes === undefined || model.supportedModes.includes(setup.mode)),
  )
}

function acceptsSetupChange(actor: SessionActor, setup: SessionSendInput['setup']): boolean {
  const opening = actor.getSnapshot().context.first.setup
  if (actor.getSnapshot().context.first.harness === 'claude')
    return (
      opening.model === setup.model &&
      opening.effort === setup.effort &&
      opening.mode === setup.mode
    )
  return opening.mode === setup.mode
}

function existingSessionInput(
  identity: SessionIdentity,
  command: SessionSendInput,
): ExistingSessionInput | null {
  if (identity.workingDirectory === null) return null
  switch (identity.harness) {
    case 'claude':
    case 'codex':
      return {
        ...command,
        argoId: identity.argoId,
        harness: identity.harness,
        nativeId: identity.nativeId,
        projectId: identity.projectId,
        cwd: identity.workingDirectory,
      }
    default:
      return null
  }
}

function resumedHarness(
  harness: ExistingSessionInput['harness'],
  codex: ActorRefFrom<typeof codexAppServerMachine> | undefined,
) {
  switch (harness) {
    case 'claude':
      return claudeSessionMachine
    case 'codex':
      return codex === undefined
        ? null
        : codexSessionMachine.provide({
            actors: codexSessionActors(requestCodexAppServer(codex)),
          })
  }
}

export const sessionSupervisorMachine = setup({
  types: {
    input: {} as SupervisorInput,
    context: {} as {
      database: DurableDatabase
      sessions: Record<string, SessionActor>
      starts: Record<string, SessionActor>
      completed: Record<
        string,
        | {
            sessionId: string
          }
        | {
            failure: string
          }
      >
      failed: Record<string, SessionActor>
    },
    events: {} as SupervisorEvent,
  },
  actors: {
    observeSession: fromCallback<
      {
        type: 'Stop'
      },
      {
        pendingId: string
        session: SessionActor
      },
      Extract<
        SupervisorEvent,
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
        session: SessionActor
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
    replyWhenReady: fromCallback<
      {
        type: 'Stop'
      },
      {
        session: SessionActor
        reply: StartReply
      }
    >(({ input }) => {
      let settled = false
      const subscription = input.session.subscribe((snapshot) => {
        if (settled) return
        if (snapshot.matches('Ready')) {
          settled = true
          const sessionId = snapshot.context.argoId
          if (sessionId === null) input.reply.reject(new Error('Session resume lost its identity.'))
          else
            input.reply.resolve({
              sessionId,
            })
        } else if (snapshot.matches('Failed') || snapshot.matches('Closed')) {
          settled = true
          input.reply.reject(new Error(snapshot.context.failure ?? 'Session resume failed.'))
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
        if (!setupIsAvailable(catalog, event.input.harness, event.input.setup)) {
          event.reply.reject(new Error('The selected Session setup is no longer available.'))
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
        let harness: typeof claudeSessionMachine | typeof codexSessionMachine
        switch (event.input.harness) {
          case 'claude':
            harness = claudeSessionMachine
            break
          case 'codex': {
            const codex = self.system.get('codex') as
              | ActorRefFrom<typeof codexAppServerMachine>
              | undefined
            if (codex === undefined) throw new Error('Codex app-server actor is unavailable.')
            harness = codexSessionMachine.provide({
              actors: codexSessionActors(requestCodexAppServer(codex)),
            })
            break
          }
          default: {
            const unknownHarness: never = event.input.harness
            throw new Error(`Unsupported Harness: ${unknownHarness}`)
          }
        }
        const actor = spawn(
          sessionMachine.provide({
            actors: {
              harness,
              persist: fromPromise<string, SessionPersistInput>(({ input: record }) => {
                return Promise.resolve(
                  upsertSession(context.database, record.session, record.projectId),
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
    forwardSend: assign({
      sessions: ({ context, event, self, spawn }) => {
        if (event.type !== 'Send') return context.sessions
        const actor = context.sessions[event.input.sessionId]
        const resumeIndexedSession = () => {
          const identity = readSessionIdentity(context.database, event.input.sessionId)
          if (identity === null) {
            event.reply.reject(new Error('Session is not indexed.'))
            return context.sessions
          }
          switch (identity.harness) {
            case 'claude':
            case 'codex': {
              const syncId = `${identity.harness}Sync` as 'claudeSync' | 'codexSync'
              const sync = self.system.get(syncId) as
                | ActorRefFrom<typeof sessionSyncMachine>
                | undefined
              sync?.send({
                type: 'Priority sync',
              })
              break
            }
            default:
              break
          }
          const input = existingSessionInput(identity, event.input)
          if (input === null) {
            event.reply.reject(new Error('Session has no supported vendor resume location.'))
            return context.sessions
          }
          if (
            !setupIsAvailable(
              self.system.get('catalog') as ActorRefFrom<typeof harnessCatalogMachine> | undefined,
              input.harness,
              input.setup,
            )
          ) {
            event.reply.reject(new Error('The selected Session setup is no longer available.'))
            return context.sessions
          }
          const harness = resumedHarness(
            input.harness,
            self.system.get('codex') as ActorRefFrom<typeof codexAppServerMachine> | undefined,
          )
          if (harness === null) {
            event.reply.reject(new Error('Codex app-server actor is unavailable.'))
            return context.sessions
          }
          const resumed = spawn(
            sessionMachine.provide({
              actors: {
                harness,
                persist: fromPromise<string, SessionPersistInput>(async () => {
                  throw new Error('An existing Session must not create another identity.')
                }),
              },
            }),
            {
              input,
            },
          )
          spawn('replyWhenReady', {
            input: {
              session: resumed,
              reply: event.reply,
            },
          })
          return {
            ...context.sessions,
            [identity.argoId]: resumed,
          }
        }
        if (actor === undefined) return resumeIndexedSession()
        if (
          !setupIsAvailable(
            self.system.get('catalog') as ActorRefFrom<typeof harnessCatalogMachine> | undefined,
            actor.getSnapshot().context.first.harness,
            event.input.setup,
          )
        ) {
          event.reply.reject(new Error('The selected Session setup is no longer available.'))
          return context.sessions
        }
        if (!acceptsSetupChange(actor, event.input.setup)) {
          event.reply.reject(
            new Error('Changing this Session setup requires starting a new Session.'),
          )
          return context.sessions
        }
        const snapshot = actor.getSnapshot()
        if (snapshot.matches('Failed') || snapshot.matches('Closed')) {
          event.reply.reject(
            new Error(snapshot.context.failure ?? 'Session is not available for sends.'),
          )
          const { [event.input.sessionId]: _closed, ...remaining } = context.sessions
          return remaining
        }
        actor.send({
          type: 'Send',
          command: event.input,
        })
        spawn('replyWhenReady', {
          input: {
            session: actor,
            reply: event.reply,
          },
        })
        return context.sessions
      },
    }),
  },
}).createMachine({
  id: 'sessionSupervisor',
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

export type SessionSupervisorActor = ActorRefFrom<typeof sessionSupervisorMachine>
