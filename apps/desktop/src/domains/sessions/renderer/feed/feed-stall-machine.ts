import { assign, setup } from 'xstate'

type FeedStallContext = {
  identity: string | null
  stalled: boolean
}

type FeedStallEvent =
  | {
      type: 'Awaiting'
      identity: string
    }
  | {
      type: 'Settled'
    }
  | {
      type: 'Timed out'
    }

export const feedStallMachine = setup({
  types: {} as {
    context: FeedStallContext
    events: FeedStallEvent
  },
  actions: {
    beginWaiting: assign(({ event }) => {
      if (event.type !== 'Awaiting') return {}
      return {
        identity: event.identity,
        stalled: false,
      }
    }),
    clearWaiting: assign({
      identity: null,
      stalled: false,
    }),
    markStalled: assign({
      stalled: true,
    }),
  },
}).createMachine({
  id: 'feed-stall',
  initial: 'ready',
  context: {
    identity: null,
    stalled: false,
  },
  states: {
    ready: {
      on: {
        Awaiting: {
          target: 'waiting',
          actions: 'beginWaiting',
        },
      },
    },
    waiting: {
      on: {
        Awaiting: {
          target: 'waiting',
          reenter: true,
          actions: 'beginWaiting',
        },
        Settled: {
          target: 'ready',
          actions: 'clearWaiting',
        },
        'Timed out': {
          target: 'stalled',
          actions: 'markStalled',
        },
      },
    },
    stalled: {
      on: {
        Awaiting: {
          target: 'waiting',
          actions: 'beginWaiting',
        },
        Settled: {
          target: 'ready',
          actions: 'clearWaiting',
        },
      },
    },
  },
})
