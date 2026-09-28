import { type ActorRefFrom, assertEvent, fromCallback, sendTo, setup } from 'xstate'
import {
  type CodexAppServerClient,
  type CodexRequest,
  createCodexAppServerClient,
} from './codex-app-server-client'

type CallEvent = {
  type: 'Call'
  run: (client: CodexAppServerClient) => void
}

type Event =
  | CallEvent
  | {
      type: 'Shutdown'
    }
  | {
      type: 'xstate.init'
      input: Input
    }

type Input = {
  client?: CodexAppServerClient
}

export const codexAppServerClientActor = fromCallback<CallEvent, Input>(({ receive, input }) => {
  const client = input.client ?? createCodexAppServerClient()
  receive((event) => event.run(client))
  return () => client.shutdown()
})

export const codexAppServerMachine = setup({
  types: {
    context: {} as Record<string, never>,
    events: {} as Event,
    input: {} as Input,
  },
  actors: {
    clientActor: codexAppServerClientActor,
  },
  actions: {
    callClient: sendTo('clientActor', ({ event }) => {
      if (event.type !== 'Call') throw new Error('Expected a Codex app-server call.')
      return event
    }),
  },
}).createMachine({
  id: 'codexAppServerMachine',
  context: {},
  initial: 'Active',
  on: {
    Shutdown: '.Closed',
  },
  states: {
    Active: {
      invoke: {
        id: 'clientActor',
        src: 'clientActor',
        input: ({ event }) => {
          assertEvent(event, 'xstate.init')
          return event.input
        },
      },
      on: {
        Call: {
          actions: 'callClient',
        },
      },
    },
    Closed: {
      type: 'final',
    },
  },
})

export function requestCodexAppServer(
  actor: ActorRefFrom<typeof codexAppServerMachine>,
): CodexRequest {
  return (method, params, parse) =>
    new Promise((resolve, reject) => {
      if (actor.getSnapshot().status !== 'active') {
        reject(new Error('Codex app-server is closed.'))
        return
      }
      actor.send({
        type: 'Call',
        run: (client) => void client.request(method, params, parse).then(resolve, reject),
      })
    })
}
