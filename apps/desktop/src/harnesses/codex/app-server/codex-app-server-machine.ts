import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { assign, createActor, fromCallback, setup, waitFor } from 'xstate'
import { type HarnessInfo, unavailable } from '@/harnesses/catalog/harness-catalog-machine'
import { executableVersion } from '@/harnesses/cli/executable-version'
import { type CodexModelCatalog, codexHarnessInfo, readModelCatalog } from '../catalog'

// The subset of `codex app-server`'s JSON-RPC protocol this adapter drives, grounded in codex-harness
// 0.147.0's generated schema (`codex app-server generate-json-schema`) and the live proof recorded
// in docs/research/2026-09-09-codex-transport.md.
export type RequestID = string | number
export type RequestParams = {
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
  } catch {
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
): CodexChannel {
  let sequence = 0
  const state: ChannelState = {
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

type Identity = {
  executablePath: string
  version: string
}
type Context = {
  executable: string | null
  version: string | null
  retryCount: number
}
type Event =
  | {
      type: 'Process ready'
      version: string
    }
  | {
      type: 'Process failed'
    }
  | {
      type: 'Process exited'
    }
  | {
      type: 'Executable changed'
      executable: string | null
    }
  | {
      type: 'Retry now'
    }
  | {
      type: 'Shutdown'
    }

export function processExitIsCurrent(channel: CodexChannel, current: CodexChannel | null) {
  return channel === current
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

export function createCodexAppServer(findExecutable: () => string | null) {
  let liveChannel: CodexChannel | null = null
  const processActor = fromCallback<
    Event,
    {
      executable: string
    }
  >(({ input, sendBack }) => {
    let disposed = false
    let channel: CodexChannel | null = null
    void (async () => {
      try {
        const version = await executableVersion(input.executable)
        if (disposed) return
        channel = openProcess(input.executable)
        channel.onExit(() => {
          if (!processExitIsCurrent(channel as CodexChannel, liveChannel)) return
          liveChannel = null
          sendBack({
            type: 'Process exited',
          })
        })
        await handshake(channel)
        if (disposed) {
          channel.close()
          return
        }
        liveChannel = channel
        sendBack({
          type: 'Process ready',
          version,
        })
      } catch {
        channel?.close()
        if (!disposed)
          sendBack({
            type: 'Process failed',
          })
      }
    })()
    return () => {
      disposed = true
      if (liveChannel === channel) liveChannel = null
      channel?.close()
    }
  })
  const machine = setup({
    types: {
      context: {} as Context,
      events: {} as Event,
      input: {} as {
        executable: string | null
      },
    },
    actors: {
      processActor,
    },
    actions: {
      changed: assign(({ event }) =>
        event.type === 'Executable changed'
          ? {
              executable: event.executable,
              version: null,
              retryCount: 0,
            }
          : {},
      ),
      ready: assign(({ event }) =>
        event.type === 'Process ready'
          ? {
              version: event.version,
              retryCount: 0,
            }
          : {},
      ),
      failed: assign({
        retryCount: ({ context }) => context.retryCount + 1,
      }),
    },
    delays: {
      retryDelay: ({ context }) => Math.min(1_000 * 2 ** context.retryCount, 30_000),
    },
  }).createMachine({
    id: 'codexAppServerMachine',
    context: ({ input }) => ({
      executable: input.executable,
      version: null,
      retryCount: 0,
    }),
    initial: 'Connected',
    on: {
      Shutdown: '.Closed',
    },
    states: {
      Connected: {
        initial: 'Starting',
        invoke: {
          src: 'processActor',
          input: ({ context }) => ({
            executable: context.executable ?? '',
          }),
        },
        on: {
          'Executable changed': {
            target: 'Connected',
            reenter: true,
            actions: 'changed',
          },
        },
        states: {
          Starting: {
            on: {
              'Process ready': {
                target: 'Ready',
                actions: 'ready',
              },
              'Process failed': {
                target: '#codexAppServerMachine.Backoff',
                actions: 'failed',
              },
              'Process exited': {
                target: '#codexAppServerMachine.Backoff',
                actions: 'failed',
              },
            },
          },
          Ready: {
            on: {
              'Process exited': {
                target: '#codexAppServerMachine.Backoff',
                actions: 'failed',
              },
            },
          },
        },
      },
      Backoff: {
        after: {
          retryDelay: 'Connected',
        },
        on: {
          'Retry now': 'Connected',
          'Executable changed': {
            target: 'Connected',
            actions: 'changed',
          },
        },
      },
      Closed: {
        type: 'final',
      },
    },
  })
  const actor = createActor(machine, {
    input: {
      executable: findExecutable(),
    },
  })
  return {
    actor,
    close: () =>
      actor.send({
        type: 'Shutdown',
      }),
    async readHarnessInfo(): Promise<HarnessInfo> {
      const executablePath = findExecutable()
      if (executablePath === null) {
        if (actor.getSnapshot().context.executable !== null)
          actor.send({
            type: 'Executable changed',
            executable: null,
          })
        return unavailable('codex')
      }
      try {
        const identity: Identity = {
          executablePath,
          version: await executableVersion(executablePath),
        }
        const current = actor.getSnapshot().context
        if (
          current.executable !== identity.executablePath ||
          (current.version !== null && current.version !== identity.version)
        ) {
          actor.send({
            type: 'Executable changed',
            executable: identity.executablePath,
          })
        }
        await waitFor(
          actor,
          (state) =>
            state.matches({
              Connected: 'Ready',
            }) &&
            state.context.executable === identity.executablePath &&
            state.context.version === identity.version,
          {
            timeout: 3_000,
          },
        )
        if (liveChannel === null) return unavailable('codex')
        const channel = liveChannel
        const catalog = await readCatalogPages(channel)
        return codexHarnessInfo(catalog)
      } catch {
        return unavailable('codex')
      }
    },
  }
}

async function readCatalogPages(channel: CodexChannel): Promise<CodexModelCatalog> {
  const data: CodexModelCatalog['data'] = []
  let cursor: string | undefined
  do {
    const page = await channel.request(
      'model/list',
      {
        includeHidden: false,
        limit: 100,
        ...(cursor === undefined
          ? {}
          : {
              cursor,
            }),
      },
      readModelCatalog,
    )
    data.push(...page.data)
    cursor = page.nextCursor ?? undefined
  } while (cursor !== undefined)
  return {
    data,
    nextCursor: null,
  }
}
