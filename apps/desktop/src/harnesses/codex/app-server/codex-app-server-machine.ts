import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { type ActorRefFrom, assign, fromCallback, sendTo, setup } from 'xstate'
import { executableVersion } from '@/harnesses/cli/executable-version'

// The subset of `codex app-server`'s JSON-RPC protocol this adapter drives, grounded in codex-harness
// 0.147.0's generated schema (`codex app-server generate-json-schema`) and the live proof recorded
// in docs/research/2026-09-09-codex-transport.md.
export type RequestID = string | number
export type RequestParams = {
  'thread/start': {
    cwd: string
    model: string
    approvalPolicy: string
    sandbox: string
  }
  'turn/start': {
    threadId: string
    input: Array<unknown>
    model: string
    effort: string
  }
  'model/list': {
    cursor?: string
    limit?: number
    includeHidden?: boolean
  }
  initialize: {
    clientInfo: {
      name: string
      title: string
      version: string
    }
    capabilities: {
      experimentalApi: boolean
      requestAttestation: boolean
    }
  }
}

export type CodexRequest = <Method extends keyof RequestParams, Result>(
  method: Method,
  params: RequestParams[Method],
  parse: (value: unknown) => Result,
) => Promise<Result>

export type WireMessage =
  | {
      method: string
      params: Record<string, unknown>
      id?: RequestID
    }
  | {
      id: RequestID
      result: unknown
    }
  | {
      id: RequestID
      error: {
        code: number
        message: string
      }
    }

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function protocolRecord(value: unknown, label: string): Record<string, unknown> {
  assert(object(value), `${label} must be an object`)
  return value
}

export function protocolString(value: unknown, label: string): string {
  assert(typeof value === 'string', `${label} must be a string`)
  return value
}

export function readMessage(line: string): WireMessage {
  const parsed: unknown = JSON.parse(line)
  const message = protocolRecord(parsed, 'Protocol envelope')
  let id: RequestID | undefined
  if (Object.hasOwn(message, 'id')) {
    assert(
      typeof message.id === 'string' || typeof message.id === 'number',
      'Invalid protocol request ID',
    )
    id = message.id
  }
  if (Object.hasOwn(message, 'method')) {
    const method = protocolString(message.method, 'Protocol method')
    assert(method.length > 0, 'Invalid protocol method')
    const params = protocolRecord(message.params, 'Protocol notification/request params')
    assert(
      !Object.hasOwn(message, 'result') && !Object.hasOwn(message, 'error'),
      'Mixed protocol envelope',
    )
    return {
      ...message,
      method,
      params,
      id,
    }
  }
  assert(id !== undefined, 'Protocol response is missing its ID')
  const hasResult = Object.hasOwn(message, 'result')
  assert(
    hasResult !== Object.hasOwn(message, 'error'),
    'Response needs exactly one result or error',
  )
  if (hasResult)
    return {
      ...message,
      id,
      result: message.result,
    }
  const error = protocolRecord(message.error, 'Protocol error')
  assert(
    typeof error.code === 'number' && Number.isInteger(error.code),
    'Protocol error is missing its numeric code',
  )
  return {
    ...message,
    id,
    error: {
      ...error,
      code: error.code,
      message: protocolString(error.message, 'Protocol error message'),
    },
  }
}

// Distinguishes "the channel dropped before we got an answer" from an ordinary JSON-RPC error
// response, so a caller can tell an uncertain outcome from a definite rejection (#2580).
export class CodexChannelClosedError extends Error {
  constructor() {
    super('Codex app-server channel closed before this request settled')
  }
}

// A spawned app-server that never replies to a request left the Roster stuck on its loading
// skeletons forever (#2653): nothing bounded how long a caller could wait on `request`, whether
// for the initial handshake or an ordinary call like `thread/list`. Two codex app-server
// processes sharing one CODEX_HOME (ours and, say, the ChatGPT desktop app's) can take
// conflicting locks on the same SQLite state; this is an open, unfixed upstream defect
// (openai/codex#21782) with no client-side workaround, so a bound here is a mitigation for a
// real external failure mode, not an arbitrary number.
export class CodexRequestTimeoutError extends Error {
  constructor(method: string) {
    super(`Codex app-server did not answer ${method} in time`)
  }
}

export const REQUEST_TIMEOUT_MS = 8_000

export type CodexProcess = {
  stdout: NodeJS.ReadableStream
  write: (line: string) => void
  kill: () => void
  onExit: (listener: () => void) => void
}

export type CodexChannel = {
  invalidMessageCount: () => number
  notify: (method: 'initialized') => void
  request: <Method extends keyof RequestParams & string, Result>(
    method: Method,
    params: RequestParams[Method],
    decode: (value: unknown) => Result,
  ) => Promise<Result>
  // Answers a still-open server->client request (`item/tool/requestUserInput`, #1841) by its own
  // request ID, so a listener that claims one can reply without the channel auto-refusing it.
  respond: (id: RequestID, result: unknown) => void
  // A listener returns `true` when it has claimed a server request and answered (or will answer)
  // it itself; the channel auto-refuses only a request no listener claims.
  onNotification: (listener: (message: WireMessage) => boolean | undefined) => void
  onExit: (listener: () => void) => void
  close: () => void
}

type PendingRequests = Map<
  RequestID,
  {
    resolve: (value: unknown) => void
    reject: (error: unknown) => void
  }
>

type ChannelState = {
  invalidMessageCount: number
  reportInvalidMessage: (error: unknown) => void
  pending: PendingRequests
  notificationListeners: Array<(message: WireMessage) => boolean | undefined>
  exitListeners: Array<() => void>
}

function refuse(process: CodexProcess, id: RequestID, method: string) {
  process.write(
    `${JSON.stringify({
      id,
      error: {
        code: -32601,
        message: `Argo does not answer ${method} yet.`,
      },
    })}\n`,
  )
}

function handleLine(process: CodexProcess, state: ChannelState, line: string) {
  let message: WireMessage
  try {
    message = readMessage(line)
  } catch (error) {
    state.invalidMessageCount += 1
    state.reportInvalidMessage(error)
    return
  }
  if ('method' in message) {
    let claimed = false
    for (const listener of state.notificationListeners) {
      if (listener(message) === true) claimed = true
    }
    if (message.id !== undefined && !claimed) refuse(process, message.id, message.method)
    return
  }
  const waiting = state.pending.get(message.id)
  if (waiting === undefined) return
  state.pending.delete(message.id)
  if ('error' in message) waiting.reject(new Error(message.error.message))
  else waiting.resolve(message.result)
}

function wireInbound(process: CodexProcess, state: ChannelState) {
  const lines = createInterface({
    input: process.stdout,
  })
  lines.on('line', (line) => handleLine(process, state, line))
  process.onExit(() => {
    for (const waiting of state.pending.values()) waiting.reject(new CodexChannelClosedError())
    state.pending.clear()
    for (const listener of state.exitListeners) listener()
  })
  return lines
}

// ADR-0024: the cockpit owns one `codex app-server` process per managed Session and speaks
// newline-delimited JSON-RPC over its stdio pipes. A server->client request no listener claims is
// refused rather than left open, because an unanswered approval holds the Turn forever
// (openai/codex#11816); `item/tool/requestUserInput` is claimed and answered for real (#1841),
// while approval requests still go unclaimed and so are still refused (#549).
export function openCodexChannel(
  process: CodexProcess,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
  reportInvalidMessage = (error: unknown) =>
    console.error('Codex app-server sent an invalid protocol message:', error),
): CodexChannel {
  let sequence = 0
  const state: ChannelState = {
    invalidMessageCount: 0,
    reportInvalidMessage,
    pending: new Map(),
    notificationListeners: [],
    exitListeners: [],
  }
  const { pending, notificationListeners, exitListeners } = state

  const send = (message: { id?: RequestID; method: string; params?: unknown }) => {
    process.write(`${JSON.stringify(message)}\n`)
  }

  const lines = wireInbound(process, state)

  return {
    invalidMessageCount: () => state.invalidMessageCount,
    notify(method) {
      send({
        method,
      })
    },
    request(method, params, decode) {
      const id = ++sequence
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new CodexRequestTimeoutError(method))
        }, requestTimeoutMs)
        timer.unref()
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timer)
            try {
              resolve(decode(value))
            } catch (error) {
              reject(error)
            }
          },
          reject: (error) => {
            clearTimeout(timer)
            reject(error)
          },
        })
        send({
          id,
          method,
          params,
        })
      })
    },
    respond(id, result) {
      process.write(
        `${JSON.stringify({
          id,
          result,
        })}\n`,
      )
    },
    onNotification(listener) {
      notificationListeners.push(listener)
    },
    onExit(listener) {
      exitListeners.push(listener)
    },
    close() {
      lines.close()
      process.kill()
    },
  }
}

type CallEvent = {
  type: 'Call'
  run: (channel: CodexChannel) => void
  reject: (error: Error) => void
}
type RequestEvent = {
  type: 'Request'
  executable: string | null
  version: string | null
  run: (channel: CodexChannel) => void
  reject: (error: Error) => void
}
type ProcessCommand =
  | {
      type: 'Open'
      executable: string | null
    }
  | {
      type: 'Close'
    }
  | {
      type: 'Queue'
      request: RequestEvent
    }
  | {
      type: 'Dispatch'
      request: RequestEvent
    }
  | {
      type: 'Dispatch waiting'
    }
  | {
      type: 'Reject waiting'
      detail: string
    }
type Context = {
  executable: string | null
  version: string | null
  expectedVersion: string | null
  retryCount: number
  failure: string | null
}
type Event =
  | CallEvent
  | RequestEvent
  | {
      type: 'Executable check failed'
      detail: string
      reject: (error: Error) => void
    }
  | {
      type: 'Process ready'
      version: string
    }
  | {
      type: 'Process failed'
      detail?: string
    }
  | {
      type: 'Process exited'
      detail?: string
    }
  | {
      type: 'Retry now'
    }
  | {
      type: 'Shutdown'
    }

function openProcess(executable: string): CodexChannel {
  const environment = {
    ...process.env,
  }
  delete environment.OPENAI_API_KEY
  delete environment.CODEX_API_KEY
  const child = spawn(
    executable,
    [
      'app-server',
      '--listen',
      'stdio://',
      '-c',
      'features.default_mode_request_user_input=true',
    ],
    {
      env: environment,
      stdio: [
        'pipe',
        'pipe',
        'pipe',
      ],
    },
  )
  child.stderr.on('data', (chunk: Buffer) => {
    console.error(`codex app-server stderr: ${chunk.toString('utf8').trimEnd()}`)
  })
  return openCodexChannel({
    stdout: child.stdout,
    write: (line) => child.stdin.write(line),
    kill: () => child.kill(),
    onExit: (listener) => {
      child.on('close', listener)
      child.on('error', listener)
    },
  })
}

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

export const codexAppServerProcessActor = fromCallback<
  ProcessCommand,
  {
    executable: string | null
  }
>(({ receive, sendBack, input }) => {
  let channel: CodexChannel | null = null
  let generation = 0
  const waiting = new Map<RequestEvent, ReturnType<typeof setTimeout>>()
  const rejectWaiting = (detail: string) => {
    for (const [request, timer] of waiting) {
      clearTimeout(timer)
      request.reject(new Error(detail))
    }
    waiting.clear()
  }
  const dispatch = (request: RequestEvent) => {
    const timer = waiting.get(request)
    if (timer !== undefined) clearTimeout(timer)
    waiting.delete(request)
    if (channel === null) {
      request.reject(new Error('Codex app-server is unavailable.'))
      return
    }
    request.run(channel)
  }
  const close = () => {
    generation += 1
    const current = channel
    channel = null
    current?.close()
  }
  const reportExit = (currentGeneration: number) => {
    if (generation !== currentGeneration) return
    channel = null
    sendBack({
      type: 'Process exited',
      detail: 'Codex app-server process exited.',
    })
  }
  const reportFailure = (currentGeneration: number, error: unknown) => {
    if (generation !== currentGeneration) return
    close()
    sendBack({
      type: 'Process failed',
      detail: String(error),
    })
  }
  const open = (executable: string | null) => {
    close()
    if (executable === null) {
      sendBack({
        type: 'Process failed',
        detail: 'Codex executable is unavailable.',
      })
      return
    }
    const currentGeneration = generation
    void (async () => {
      try {
        const version = await executableVersion(executable)
        if (generation !== currentGeneration) return
        const opened = openProcess(executable)
        channel = opened
        opened.onExit(() => reportExit(currentGeneration))
        await handshake(opened)
        if (generation !== currentGeneration) return
        sendBack({
          type: 'Process ready',
          version,
        })
      } catch (error) {
        reportFailure(currentGeneration, error)
      }
    })()
  }
  receive((command) => {
    switch (command.type) {
      case 'Open':
        open(command.executable)
        return
      case 'Close':
        close()
        return
      case 'Queue': {
        const timer = setTimeout(() => {
          waiting.delete(command.request)
          command.request.reject(new Error('Codex app-server did not become ready in time.'))
        }, 3_000)
        timer.unref()
        waiting.set(command.request, timer)
        return
      }
      case 'Dispatch':
        dispatch(command.request)
        return
      case 'Dispatch waiting':
        for (const request of waiting.keys()) dispatch(request)
        return
      case 'Reject waiting':
        rejectWaiting(command.detail)
        return
    }
  })
  if (input.executable !== null) open(input.executable)
  return () => {
    close()
    rejectWaiting('Codex app-server closed before the request was sent.')
  }
})

export const codexAppServerMachine = setup({
  types: {
    context: {} as Context,
    events: {} as Event,
    input: {} as {
      executable: string | null
    },
  },
  actors: {
    processActor: fromCallback<
      ProcessCommand,
      {
        executable: string | null
      }
    >(() => {
      throw new Error('The application must provide the Codex process actor.')
    }),
  },
  guards: {
    hasExecutable: ({ context }) => context.executable !== null,
    missingExecutable: ({ event }) => event.type === 'Request' && event.executable === null,
    sameExecutable: ({ context, event }) =>
      event.type === 'Request' &&
      event.executable !== null &&
      context.executable === event.executable &&
      (context.version ?? context.expectedVersion ?? event.version) === event.version,
    readyVersionMatches: ({ context, event }) =>
      event.type === 'Process ready' &&
      (context.expectedVersion === null || context.expectedVersion === event.version),
  },
  actions: {
    inspectExecutable: () => {
      throw new Error('The application must provide Codex executable discovery.')
    },
    openProcess: sendTo('processActor', ({ context }) => ({
      type: 'Open',
      executable: context.executable,
    })),
    closeProcess: sendTo('processActor', () => ({
      type: 'Close',
    })),
    queueRequest: sendTo('processActor', ({ event }) => {
      if (event.type !== 'Request') throw new Error('Expected a Codex request.')
      return {
        type: 'Queue',
        request: event,
      }
    }),
    dispatchRequest: sendTo('processActor', ({ event }) => {
      if (event.type !== 'Request') throw new Error('Expected a Codex request.')
      return {
        type: 'Dispatch',
        request: event,
      }
    }),
    dispatchWaiting: sendTo('processActor', () => ({
      type: 'Dispatch waiting',
    })),
    rejectChangedRequests: sendTo('processActor', () => ({
      type: 'Reject waiting',
      detail: 'Codex executable changed before the request was sent.',
    })),
    setExecutable: assign(({ event }) => {
      if (event.type !== 'Request') return {}
      return {
        executable: event.executable,
        version: null,
        expectedVersion: event.version,
        retryCount: 0,
        failure: null,
      }
    }),
    setExpectedVersion: assign(({ event }) =>
      event.type === 'Request'
        ? {
            expectedVersion: event.version,
          }
        : {},
    ),
    recordReady: assign(({ event }) =>
      event.type === 'Process ready'
        ? {
            version: event.version,
            expectedVersion: event.version,
            retryCount: 0,
            failure: null,
          }
        : {},
    ),
    recordFailure: assign(({ context, event }) => ({
      retryCount: context.retryCount + 1,
      failure:
        event.type === 'Process failed' || event.type === 'Process exited'
          ? (event.detail ?? 'Codex app-server is unavailable.')
          : context.failure,
    })),
    recordVersionMismatch: assign(({ context, event }) => ({
      retryCount: context.retryCount + 1,
      failure:
        event.type === 'Process ready'
          ? `Codex app-server version ${event.version} did not match ${context.expectedVersion}.`
          : context.failure,
    })),
    recordCheckFailure: assign(({ event }) => ({
      failure: event.type === 'Executable check failed' ? event.detail : null,
    })),
    rejectCheckRequest: ({ event }) => {
      if (event.type === 'Executable check failed') event.reject(new Error(event.detail))
    },
    rejectRequest: ({ event }) => {
      if (event.type === 'Request') event.reject(new Error('Codex executable is unavailable.'))
    },
  },
  delays: {
    retryDelay: ({ context }) => Math.min(1_000 * 2 ** context.retryCount, 30_000),
  },
}).createMachine({
  id: 'codexAppServerMachine',
  context: ({ input }) => ({
    executable: input.executable,
    version: null,
    expectedVersion: null,
    retryCount: 0,
    failure: null,
  }),
  initial: 'Active',
  on: {
    Shutdown: '.Closed',
  },
  states: {
    Active: {
      invoke: {
        id: 'processActor',
        src: 'processActor',
        input: ({ context }) => ({
          executable: context.executable,
        }),
      },
      initial: 'Unavailable',
      on: {
        Call: {
          actions: 'inspectExecutable',
        },
        'Executable check failed': {
          actions: [
            'recordCheckFailure',
            'rejectCheckRequest',
          ],
        },
        Request: [
          {
            guard: 'missingExecutable',
            target: '.Unavailable',
            actions: [
              'closeProcess',
              'rejectChangedRequests',
              'setExecutable',
              'rejectRequest',
            ],
          },
          {
            target: '.Connected.Starting',
            actions: [
              'rejectChangedRequests',
              'setExecutable',
              'queueRequest',
              'openProcess',
            ],
          },
        ],
      },
      states: {
        Unavailable: {
          always: {
            guard: 'hasExecutable',
            target: 'Connected',
          },
          on: {
            Request: [
              {
                guard: 'missingExecutable',
                actions: 'rejectRequest',
              },
              {
                target: 'Connected',
                actions: [
                  'setExecutable',
                  'queueRequest',
                  'openProcess',
                ],
              },
            ],
          },
        },
        Connected: {
          initial: 'Starting',
          states: {
            Starting: {
              on: {
                Request: {
                  guard: 'sameExecutable',
                  actions: [
                    'setExpectedVersion',
                    'queueRequest',
                  ],
                },
                'Process ready': [
                  {
                    guard: 'readyVersionMatches',
                    target: 'Ready',
                    actions: 'recordReady',
                  },
                  {
                    target: '#codexAppServerMachine.Active.Backoff',
                    actions: 'recordVersionMismatch',
                  },
                ],
                'Process failed': {
                  target: '#codexAppServerMachine.Active.Backoff',
                  actions: 'recordFailure',
                },
                'Process exited': {
                  target: '#codexAppServerMachine.Active.Backoff',
                  actions: 'recordFailure',
                },
              },
            },
            Ready: {
              entry: 'dispatchWaiting',
              on: {
                Request: {
                  guard: 'sameExecutable',
                  actions: 'dispatchRequest',
                },
                'Process exited': {
                  target: '#codexAppServerMachine.Active.Backoff',
                  actions: 'recordFailure',
                },
              },
            },
          },
        },
        Backoff: {
          entry: 'closeProcess',
          after: {
            retryDelay: {
              target: 'Connected',
              actions: 'openProcess',
            },
          },
          on: {
            'Retry now': {
              target: 'Connected',
              actions: 'openProcess',
            },
            Request: {
              guard: 'sameExecutable',
              target: 'Connected',
              actions: [
                'setExpectedVersion',
                'queueRequest',
                'openProcess',
              ],
            },
          },
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
        run: (channel) => void channel.request(method, params, parse).then(resolve, reject),
        reject,
      })
    })
}
