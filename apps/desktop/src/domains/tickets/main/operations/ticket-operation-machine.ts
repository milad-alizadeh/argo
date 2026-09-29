// One Ticket write, a status or a priority: record the intent, ask the provider, then commit what it
// confirmed. The saved Ticket changes only in the last step, so a refusal never shows the request.
import { assign, fromPromise, setup } from 'xstate'
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import type {
  TicketErrorCode,
  TicketPriority,
  TicketStatus,
} from '@/domains/tickets/contract/contract'
import { closureOf, type PriorityChange } from '@/domains/tickets/contract/ticket'
import { saveConfirmedFields } from '../database/ticket-upsert'
import {
  type RecordedIntent,
  recordIntent,
  settleIntent,
  type TicketWriteTarget,
} from './ticket-write-intents'

type TicketChange =
  | {
      operation: 'status'
      statusId: string
    }
  | {
      operation: 'priority'
      priorityLevel: PriorityChange['priorityLevel']
    }

export type TicketOperationRequest = TicketWriteTarget & {
  accountId: string
} & TicketChange

export type StatusRequest = Extract<
  TicketOperationRequest,
  {
    operation: 'status'
  }
>
export type PriorityRequest = Extract<
  TicketOperationRequest,
  {
    operation: 'priority'
  }
>

// What the provider confirmed, as the fields the saved Ticket takes.
export type ConfirmedFields =
  | {
      operation: 'status'
      status: TicketStatus
    }
  | {
      operation: 'priority'
      priority: TicketPriority | null
    }

export type TicketWrite =
  | {
      ok: true
      confirmed: ConfirmedFields
    }
  | {
      ok: false
      failure: TicketErrorCode
    }

export type TicketOperationDependencies = {
  database: Database
  // Asks the provider to change the Ticket, as the Account, through Account access.
  write: (request: TicketOperationRequest) => Promise<TicketWrite>
  // Called after a commit that changes what a Ticket query answers.
  changed: (target: TicketScopeTarget) => void
}

export type TicketOperationOutcome =
  | {
      type: 'committed'
      confirmed: ConfirmedFields
    }
  | {
      type: 'rejected'
      failure: TicketErrorCode
    }
  // The provider may or may not have applied the change; nothing sends it again.
  | {
      type: 'uncertain'
      failure: TicketErrorCode
    }

type OperationInput = {
  dependencies: TicketOperationDependencies
  request: TicketOperationRequest
}
export type CommitInput = OperationInput & {
  intent: RecordedIntent
  confirmed: ConfirmedFields
}
export type SettleInput = OperationInput & {
  intent: RecordedIntent
  phase: 'rejected' | 'uncertain'
  failure: TicketErrorCode
}

const savedFields = (confirmed: ConfirmedFields) =>
  confirmed.operation === 'status'
    ? {
        status: confirmed.status,
        state: closureOf(confirmed.status.category),
      }
    : {
        priority: confirmed.priority,
      }

// A failure that leaves the provider's answer unknown, as opposed to one it gave.
const UNCERTAIN: ReadonlySet<TicketErrorCode> = new Set([
  'connection-lost',
  'invalid-response',
  'github-unreachable',
  'linear-unreachable',
  'storage-not-written',
])

export const ticketOperationMachine = setup({
  types: {
    input: {} as OperationInput,
    context: {} as OperationInput & {
      intent: RecordedIntent | null
      // What the provider confirmed, held until it is committed.
      confirmed: ConfirmedFields | null
      outcome: TicketOperationOutcome | null
    },
    output: {} as TicketOperationOutcome,
  },
  actors: {
    record: fromPromise(async ({ input }: { input: OperationInput }) =>
      recordIntent(input.dependencies.database, input.request),
    ),
    call: fromPromise(async ({ input }: { input: OperationInput }): Promise<TicketWrite> => {
      try {
        return await input.dependencies.write(input.request)
      } catch {
        return {
          ok: false,
          failure: 'connection-lost',
        }
      }
    }),
    // The confirmed status and the settled intent commit together, then the change is announced.
    commit: fromPromise(async ({ input }: { input: CommitInput }) => {
      const { dependencies, request, intent, confirmed } = input
      dependencies.database.transaction((transaction) => {
        saveConfirmedFields(transaction, request, savedFields(confirmed))
        settleIntent(transaction, {
          intentId: intent.intentId,
          phase: 'committed',
        })
      })
      dependencies.changed(request)
    }),
    settle: fromPromise(async ({ input }: { input: SettleInput }) => {
      settleIntent(input.dependencies.database, {
        intentId: input.intent.intentId,
        phase: input.phase,
        failure: input.failure,
      })
    }),
  },
}).createMachine({
  id: 'ticketOperation',
  initial: 'Recording',
  context: ({ input }) => ({
    ...input,
    intent: null,
    confirmed: null,
    outcome: null,
  }),
  output: ({ context }) =>
    context.outcome ?? {
      type: 'rejected',
      failure: 'storage-unavailable',
    },
  states: {
    Recording: {
      invoke: {
        src: 'record',
        input: ({ context }) => ({
          dependencies: context.dependencies,
          request: context.request,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output === null,
            target: 'Done',
            actions: assign({
              outcome: {
                type: 'rejected',
                failure: 'ticket-not-found',
              },
            }),
          },
          {
            target: 'Calling',
            actions: assign({
              intent: ({ event }) => event.output,
            }),
          },
        ],
        onError: {
          target: 'Done',
          actions: assign({
            outcome: {
              type: 'rejected',
              failure: 'storage-unavailable',
            },
          }),
        },
      },
    },
    Calling: {
      invoke: {
        src: 'call',
        input: ({ context }) => ({
          dependencies: context.dependencies,
          request: context.request,
        }),
        onDone: [
          {
            guard: ({ event }) => event.output.ok,
            target: 'Committing',
            actions: assign({
              confirmed: ({ event }) => (event.output.ok ? event.output.confirmed : null),
            }),
          },
          {
            target: 'Settling',
            actions: assign({
              outcome: ({ event }): TicketOperationOutcome => {
                const failure = event.output.ok ? 'invalid-response' : event.output.failure
                return {
                  type: UNCERTAIN.has(failure) ? 'uncertain' : 'rejected',
                  failure,
                }
              },
            }),
          },
        ],
      },
    },
    Committing: {
      invoke: {
        src: 'commit',
        input: ({ context }) => {
          const { intent, confirmed } = context
          if (intent === null || confirmed === null) throw new Error('Nothing was confirmed.')
          return {
            dependencies: context.dependencies,
            request: context.request,
            intent,
            confirmed,
          }
        },
        onDone: {
          target: 'Done',
          actions: assign({
            outcome: ({ context }): TicketOperationOutcome =>
              context.confirmed === null
                ? {
                    type: 'rejected',
                    failure: 'invalid-response',
                  }
                : {
                    type: 'committed',
                    confirmed: context.confirmed,
                  },
          }),
        },
        onError: {
          target: 'Settling',
          actions: assign({
            outcome: {
              type: 'uncertain',
              failure: 'storage-not-written',
            },
          }),
        },
      },
    },
    Settling: {
      invoke: {
        src: 'settle',
        input: ({ context }) => {
          const { outcome, intent } = context
          if (outcome === null || outcome.type === 'committed' || intent === null) {
            throw new Error('Nothing to settle.')
          }
          return {
            dependencies: context.dependencies,
            request: context.request,
            intent,
            phase: outcome.type,
            failure: outcome.failure,
          }
        },
        onDone: 'Done',
        onError: 'Done',
      },
    },
    Done: {
      type: 'final',
    },
  },
})
