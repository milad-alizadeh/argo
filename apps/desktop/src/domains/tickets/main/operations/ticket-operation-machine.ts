// One Ticket status change: record the intent, ask the provider, then commit what it confirmed.
// The saved Ticket changes only in the last step, so a refusal never shows the requested status.
import { assign, fromPromise, setup } from 'xstate'
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import type { TicketErrorCode, TicketStatus } from '@/domains/tickets/contract/contract'
import { closureOf } from '@/domains/tickets/contract/ticket'
import { saveConfirmedFields } from '../database/ticket-upsert'
import {
  type RecordedIntent,
  recordStatusIntent,
  settleIntent,
  type TicketWriteTarget,
} from './ticket-write-intents'

export type StatusOperationRequest = TicketWriteTarget & {
  accountId: string
  statusId: string
}

export type StatusWrite =
  | {
      ok: true
      status: TicketStatus
    }
  | {
      ok: false
      failure: TicketErrorCode
    }

export type TicketOperationDependencies = {
  database: Database
  // Asks the provider to move the Ticket, as the Account, through Account access.
  writeStatus: (request: StatusOperationRequest) => Promise<StatusWrite>
  // Called after a commit that changes what a Ticket query answers.
  changed: (target: TicketScopeTarget) => void
}

export type StatusOperationOutcome =
  | {
      type: 'committed'
      status: TicketStatus
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
  request: StatusOperationRequest
}
export type CommitInput = OperationInput & {
  intent: RecordedIntent
  status: TicketStatus
}
export type SettleInput = OperationInput & {
  intent: RecordedIntent
  phase: 'rejected' | 'uncertain'
  failure: TicketErrorCode
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
      // The status the provider confirmed, held until it is committed.
      confirmed: TicketStatus | null
      outcome: StatusOperationOutcome | null
    },
    output: {} as StatusOperationOutcome,
  },
  actors: {
    record: fromPromise(async ({ input }: { input: OperationInput }) =>
      recordStatusIntent(input.dependencies.database, input.request, input.request.statusId),
    ),
    call: fromPromise(async ({ input }: { input: OperationInput }): Promise<StatusWrite> => {
      try {
        return await input.dependencies.writeStatus(input.request)
      } catch {
        return {
          ok: false,
          failure: 'connection-lost',
        }
      }
    }),
    // The confirmed status and the settled intent commit together, then the change is announced.
    commit: fromPromise(async ({ input }: { input: CommitInput }) => {
      const { dependencies, request, intent, status } = input
      dependencies.database.transaction((transaction) => {
        saveConfirmedFields(transaction, request, {
          status,
          state: closureOf(status.category),
        })
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
              confirmed: ({ event }) => (event.output.ok ? event.output.status : null),
            }),
          },
          {
            target: 'Settling',
            actions: assign({
              outcome: ({ event }): StatusOperationOutcome => {
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
            status: confirmed,
          }
        },
        onDone: {
          target: 'Done',
          actions: assign({
            outcome: ({ context }): StatusOperationOutcome =>
              context.confirmed === null
                ? {
                    type: 'rejected',
                    failure: 'invalid-response',
                  }
                : {
                    type: 'committed',
                    status: context.confirmed,
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
