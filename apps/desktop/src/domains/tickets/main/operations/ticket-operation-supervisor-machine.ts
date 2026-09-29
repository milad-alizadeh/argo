// The app's Ticket writes: one operation per Ticket at a time, and a second one waits its turn.
import { type ActorRefFrom, enqueueActions, setup, stopChild } from 'xstate'
import {
  type PriorityRequest,
  type StatusRequest,
  type TicketOperationDependencies,
  type TicketOperationOutcome,
  type TicketOperationRequest,
  ticketOperationMachine,
} from './ticket-operation-machine'

export type TicketOperationSupervisorInput = TicketOperationDependencies

export type TicketOperationCommand = {
  type: 'ChangeStatus' | 'ChangePriority'
  request: TicketOperationRequest
  // Answers the caller once the operation ends; it is called exactly once.
  reply: (outcome: TicketOperationOutcome) => void
}

type Waiting = Pick<TicketOperationCommand, 'request' | 'reply'>

type FinishedEvent = {
  type: `xstate.done.actor.${string}`
  actorId: string
  output: TicketOperationOutcome
}

const keyOf = ({ provider, scope, key }: TicketOperationRequest) =>
  `ticket-operation:${JSON.stringify([
    provider,
    scope,
    key,
  ])}`

export const ticketOperationSupervisorMachine = setup({
  types: {
    input: {} as TicketOperationSupervisorInput,
    context: {} as {
      dependencies: TicketOperationDependencies
      // The caller waiting on each running operation.
      running: Record<string, Waiting['reply']>
      // Operations for a Ticket that already has one running, in arrival order.
      waiting: Record<string, Waiting[]>
    },
    events: {} as
      | TicketOperationCommand
      | FinishedEvent
      | {
          type: 'Shutdown'
        },
  },
  actors: {
    operation: ticketOperationMachine,
  },
  actions: {
    change: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'ChangeStatus' && event.type !== 'ChangePriority') return
      const key = keyOf(event.request)
      if (context.running[key]) {
        enqueue.assign({
          waiting: {
            ...context.waiting,
            [key]: [
              ...(context.waiting[key] ?? []),
              {
                request: event.request,
                reply: event.reply,
              },
            ],
          },
        })
        return
      }
      enqueue.spawnChild('operation', {
        id: key,
        input: {
          dependencies: context.dependencies,
          request: event.request,
        },
      })
      enqueue.assign({
        running: {
          ...context.running,
          [key]: event.reply,
        },
      })
    }),
    finish: enqueueActions(
      (
        { context, enqueue },
        {
          key,
          outcome,
        }: {
          key: string
          outcome: TicketOperationOutcome
        },
      ) => {
        enqueue(stopChild(key))
        const { [key]: reply, ...running } = context.running
        reply?.(outcome)
        const [next, ...rest] = context.waiting[key] ?? []
        const { [key]: _served, ...waiting } = context.waiting
        enqueue.assign({
          running,
          waiting:
            rest.length === 0
              ? waiting
              : {
                  ...waiting,
                  [key]: rest,
                },
        })
        if (next !== undefined)
          enqueue.raise({
            type: next.request.operation === 'status' ? 'ChangeStatus' : 'ChangePriority',
            ...next,
          })
      },
    ),
  },
}).createMachine({
  id: 'ticketOperationSupervisor',
  initial: 'Running',
  context: ({ input }) => ({
    dependencies: input,
    running: {},
    waiting: {},
  }),
  states: {
    Running: {
      on: {
        ChangeStatus: {
          actions: 'change',
        },
        ChangePriority: {
          actions: 'change',
        },
        'xstate.done.actor.*': {
          actions: {
            type: 'finish',
            params: ({ event }) => ({
              key: event.actorId,
              outcome: event.output,
            }),
          },
        },
        Shutdown: 'Closed',
      },
    },
    Closed: {
      type: 'final',
    },
  },
})

export type TicketOperationSupervisorActor = ActorRefFrom<typeof ticketOperationSupervisorMachine>

function send(
  actor: Pick<TicketOperationSupervisorActor, 'send'>,
  type: TicketOperationCommand['type'],
  request: TicketOperationRequest,
): Promise<TicketOperationOutcome> {
  return new Promise((resolve) =>
    actor.send({
      type,
      request,
      reply: resolve,
    }),
  )
}

// Sends one status change and resolves with how it ended.
export const changeTicketStatus = (
  actor: Pick<TicketOperationSupervisorActor, 'send'>,
  request: StatusRequest,
) => send(actor, 'ChangeStatus', request)

// Sends one priority change and resolves with how it ended.
export const changeTicketPriority = (
  actor: Pick<TicketOperationSupervisorActor, 'send'>,
  request: PriorityRequest,
) => send(actor, 'ChangePriority', request)
