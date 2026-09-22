import { type ActorRefFrom, assign, createActor, fromPromise, setup } from 'xstate'
import { codexLaunchEnvironment } from '../launch-environment'
import type { WireMessage } from '../protocol'
import { CodexSessionDriverError } from '../session/codex-session-error'
import type { CodexChannel } from './codex-channel'
import { openAppServer } from './open-app-server'

// ADR-0047: one shared `codex app-server` process per window, multiplexing every managed Codex
// Session as a thread over one JSON-RPC channel, in place of the one-process-per-Session shape
// ADR-0024 originally described.
export type AppServerSupervisorDeps = {
  findExecutable: () => string | null
  dispatchNotification: (message: WireMessage) => void
  onChannelLost: () => void
  onChannelRestored: () => void
}

export type CodexSessionPort = Pick<CodexChannel, 'request' | 'notify' | 'respond'>

async function handshake(channel: CodexChannel) {
  await channel.request(
    'initialize',
    {
      clientInfo: {
        name: 'argo',
        title: 'Argo',
        version: '1',
      },
      capabilities: {
        experimentalApi: false,
        requestAttestation: false,
      },
    },
    (value) => value,
  )
  channel.notify('initialized')
}

type SupervisorContext = {
  executable: string | null
  retryCount: number
}
type SupervisorEvent =
  | {
      type: 'Process exited'
    }
  | {
      type: 'Retry now'
    }
  | {
      type: 'Shutdown'
    }

// The live channel is owned entirely inside `runAppServerProcess`'s closure and handed out through
// `getChannel`, never copied into XState context (channels are not serializable, ADR-0047).
function createAppServerProcessActor(deps: AppServerSupervisorDeps) {
  let liveChannel: CodexChannel | null = null
  let notifyProcessExited: (() => void) | null = null

  const runAppServerProcess = fromPromise<
    {
      channel: CodexChannel
    },
    {
      executable: string
    }
  >(async ({ input, signal }) => {
    if (input.executable === '') throw new CodexSessionDriverError('harness-unavailable')
    const { process: child, channel } = openAppServer({
      executable: input.executable,
      env: codexLaunchEnvironment(),
    })
    channel.onNotification((message) => {
      deps.dispatchNotification(message)
      return undefined
    })
    signal.addEventListener('abort', () => {
      channel.close()
    })
    try {
      await handshake(channel)
    } catch (error) {
      channel.close()
      throw error instanceof Error ? error : new CodexSessionDriverError('launch-failed')
    }
    liveChannel = channel
    channel.onExit(() => {
      liveChannel = null
      notifyProcessExited?.()
    })
    void child
    return {
      channel,
    }
  })

  return {
    runAppServerProcess,
    getChannel: () => liveChannel,
    // The invoked actor's own lifecycle ends once the promise resolves (Ready), so a later
    // process exit can't reach the machine through onDone/onError — it has to reach the running
    // actor directly. The supervisor actor doesn't exist yet when this closure is built, so it
    // wires its own `send` in after creating it (see `createAppServerSupervisor`).
    setProcessExitedListener: (listener: () => void) => {
      notifyProcessExited = listener
    },
  }
}

export type AppServerSupervisor = {
  actor: ReturnType<typeof createActor<ReturnType<typeof createAppServerSupervisorMachine>>>
  getChannel: () => CodexChannel | null
  close: () => void
}

function createAppServerSupervisorMachine(
  runAppServerProcess: ReturnType<typeof createAppServerProcessActor>['runAppServerProcess'],
  deps: Pick<AppServerSupervisorDeps, 'onChannelLost' | 'onChannelRestored'>,
) {
  return setup({
    types: {
      context: {} as SupervisorContext,
      events: {} as SupervisorEvent,
      input: {} as {
        executable: string | null
      },
    },
    actors: {
      runAppServerProcess,
    },
    actions: {
      resetRetryCount: assign({
        retryCount: 0,
      }),
      incrementRetryCount: assign({
        retryCount: ({ context }) => context.retryCount + 1,
      }),
      notifyChannelLost: () => deps.onChannelLost(),
      notifyChannelRestored: () => deps.onChannelRestored(),
    },
    delays: {
      retryDelay: ({ context }) => Math.min(1_000 * 2 ** context.retryCount, 30_000),
    },
  }).createMachine({
    id: 'codexAppServerSupervisorMachine',
    context: ({ input }) => ({
      executable: input.executable,
      retryCount: 0,
    }),
    initial: 'Starting',
    states: {
      Starting: {
        invoke: {
          src: 'runAppServerProcess',
          input: ({ context }) => ({
            executable: context.executable ?? '',
          }),
          onDone: {
            target: 'Ready',
            actions: 'resetRetryCount',
          },
          onError: 'Backoff',
        },
      },
      Ready: {
        entry: 'notifyChannelRestored',
        on: {
          'Process exited': 'Backoff',
          Shutdown: 'ShuttingDown',
        },
      },
      Backoff: {
        entry: [
          'incrementRetryCount',
          'notifyChannelLost',
        ],
        after: {
          retryDelay: 'Starting',
        },
        on: {
          'Retry now': 'Starting',
          Shutdown: 'ShuttingDown',
        },
      },
      ShuttingDown: {
        type: 'final',
      },
    },
  })
}

// One supervisor per window process, per ADR-0047: it owns app-server startup, the shared JSON-RPC
// channel, and reconnect/backoff. `dispatchNotification`, `onChannelLost` and `onChannelRestored`
// fan out to whichever managed-Session child actors are registered; the caller (the Session
// adapter) owns that registry, not the supervisor.
export function createAppServerSupervisor(deps: AppServerSupervisorDeps): AppServerSupervisor {
  const { getChannel, runAppServerProcess, setProcessExitedListener } =
    createAppServerProcessActor(deps)
  const machine = createAppServerSupervisorMachine(runAppServerProcess, deps)
  const actor = createActor(machine, {
    input: {
      executable: deps.findExecutable(),
    },
  })
  setProcessExitedListener(() =>
    actor.send({
      type: 'Process exited',
    }),
  )
  return {
    actor,
    getChannel,
    close: () => {
      actor.send({
        type: 'Shutdown',
      })
      getChannel()?.close()
    },
  }
}

export type SupervisorActorRef = ActorRefFrom<ReturnType<typeof createAppServerSupervisorMachine>>
