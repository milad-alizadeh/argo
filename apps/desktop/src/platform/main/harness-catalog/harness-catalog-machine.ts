import { assign, fromPromise, setup } from 'xstate'
import { type HarnessCatalog, unavailableCatalog } from '@/harnesses/harness-catalog'

type HarnessCatalogEvent =
  | {
      type: 'Catalog requested'
    }
  | {
      type: 'Refresh'
    }
  | {
      type: 'Retry'
    }
  | {
      type: 'xstate.done.actor.loadCatalog'
      output: HarnessCatalog
    }
  | {
      type: 'xstate.error.actor.loadCatalog'
      error: unknown
    }

export const harnessCatalogMachine = setup({
  types: {
    context: {} as {
      catalog: HarnessCatalog
      failure: string | null
      invalidResponseCount: number
    },
    events: {} as HarnessCatalogEvent,
  },
  actors: {
    loadCatalog: fromPromise<HarnessCatalog>(async () => {
      throw new Error('Harness catalog load actor was not provided.')
    }),
  },
  actions: {
    clearFailure: assign({
      failure: () => null,
    }),
  },
}).createMachine({
  id: 'harnessCatalog',
  initial: 'Idle',
  context: {
    catalog: unavailableCatalog(),
    failure: null,
    invalidResponseCount: 0,
  },
  states: {
    Idle: {
      on: {
        'Catalog requested': 'Loading',
        Refresh: 'Loading',
        Retry: 'Loading',
      },
    },
    Loading: {
      entry: 'clearFailure',
      invoke: {
        src: 'loadCatalog',
        onDone: {
          target: 'Ready',
          actions: assign({
            catalog: ({ event }) => event.output,
            invalidResponseCount: ({ context, event }) =>
              context.invalidResponseCount +
              event.output.harnesses.filter(
                (info) => info.availability === 'unavailable' && info.reason === 'invalid-response',
              ).length,
          }),
        },
        onError: {
          target: 'Failed',
          actions: assign({
            failure: ({ event }) => String(event.error),
          }),
        },
      },
      on: {
        Refresh: 'Loading',
        Retry: 'Loading',
        'Catalog requested': {},
      },
    },
    Ready: {
      on: {
        Refresh: 'Loading',
        Retry: 'Loading',
      },
    },
    Failed: {
      on: {
        Refresh: 'Loading',
        Retry: 'Loading',
      },
    },
  },
})
