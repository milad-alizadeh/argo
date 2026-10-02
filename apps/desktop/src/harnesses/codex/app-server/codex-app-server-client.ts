import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { executableVersion } from '@/harnesses/cli/executable-version'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { SESSION_CODEX_EXECUTABLE_ENV } from '../proof-protocol'
import type { ConfigReadParams } from './protocol-generated/v2/config-read-params'
import type { ConfigValueWriteParams } from './protocol-generated/v2/config-value-write-params'
import type { SkillsListParams } from './protocol-generated/v2/skills-list-params'
import type { ThreadTurnsListParams } from './protocol-generated/v2/thread-turns-list-params'

// The base protocol uses the 0.147.0 schema; the thread/resume sandbox override was verified against 0.157.0.
export type RequestID = string | number
export const CODEX_SESSION_SOURCE_KINDS = [
  'cli',
  'vscode',
  'appServer',
  'subAgent',
  'subAgentReview',
  'subAgentCompact',
  'subAgentThreadSpawn',
  'subAgentOther',
] as const
const CODEX_THREAD_SOURCE_KINDS = ['exec', ...CODEX_SESSION_SOURCE_KINDS, 'unknown'] as const
type CodexThreadSourceKind = (typeof CODEX_THREAD_SOURCE_KINDS)[number]

type RequestParams = {
  'thread/start': {
    cwd: string
    model: string
    approvalPolicy: string
    sandbox: string
  }
  'thread/resume': {
    threadId: string
    sandbox?: string
  }
  'turn/start': {
    threadId: string
    input: Array<unknown>
    model: string
    effort: string
  }
  'turn/interrupt': {
    threadId: string
    turnId: string
  }
  'model/list': {
    cursor?: string
    limit?: number
    includeHidden?: boolean
  }
  'thread/list': {
    cursor?: string
    limit?: number
    sortKey?: 'created_at' | 'updated_at' | 'recency_at'
    sortDirection?: 'asc' | 'desc'
    sourceKinds?: CodexThreadSourceKind[]
    archived?: boolean
    useStateDbOnly?: boolean
  }
  // History comes from `thread/turns/list`; the full read is deprecated for paginated threads.
  'thread/read': {
    threadId: string
    includeTurns: false
  }
  'thread/turns/list': ThreadTurnsListParams
  'skills/list': SkillsListParams
  'config/read': ConfigReadParams
  'config/value/write': ConfigValueWriteParams
  initialize: {
    clientInfo: {
      name: string
      title: string
      version: string
    }
    capabilities: {
      experimentalApi: false
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

function protocolRecord(value: unknown, label: string): Record<string, unknown> {
  assert(object(value), `${label} must be an object`)
  return value
}

function protocolString(value: unknown, label: string): string {
  assert(typeof value === 'string', `${label} must be a string`)
  return value
}

function readMessage(line: string): WireMessage {
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

class CodexChannelClosedError extends Error {
  constructor() {
    super('Codex app-server channel closed before this request settled')
  }
}

class CodexProtocolError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

// Codex's answer for a thread it finds neither loaded nor stored, such as one with no rollout yet.
export const isThreadNotLoaded = (error: unknown) =>
  error instanceof Error && /thread not loaded/i.test(error.message)

// Conflicting app-server processes can hold the same upstream SQLite locks indefinitely (#2653).
export class CodexRequestTimeoutError extends Error {
  constructor(method: string) {
    super(`Codex app-server did not answer ${method} in time`)
  }
}

// No `codex` on this machine, so Argo cannot read any Codex Session.
export class CodexUnavailableError extends Error {
  constructor() {
    super('Codex executable is unavailable.')
  }
}

const REQUEST_TIMEOUT_MS = 8_000

export type CodexProcess = {
  stdout: NodeJS.ReadableStream
  write: (line: string) => void
  kill: () => void
  onExit: (listener: () => void) => void
}

export type CodexChannel = {
  invalidMessageCount: () => number
  notify: (method: 'initialized') => void
  request: CodexRequest
  respond: (id: RequestID, result: unknown) => void
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
  closed: boolean
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
  if ('error' in message)
    waiting.reject(new CodexProtocolError(message.error.code, message.error.message))
  else waiting.resolve(message.result)
}

function finishChannel(state: ChannelState) {
  if (state.closed) return
  state.closed = true
  for (const waiting of state.pending.values()) waiting.reject(new CodexChannelClosedError())
  state.pending.clear()
  for (const listener of state.exitListeners) listener()
}

export function openCodexChannel(
  process: CodexProcess,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
  reportInvalidMessage = (error: unknown) =>
    console.error('Codex app-server sent an invalid protocol message:', error),
): CodexChannel {
  let sequence = 0
  const state: ChannelState = {
    closed: false,
    invalidMessageCount: 0,
    reportInvalidMessage,
    pending: new Map(),
    notificationListeners: [],
    exitListeners: [],
  }
  const lines = createInterface({
    input: process.stdout,
  })
  lines.on('line', (line) => handleLine(process, state, line))
  process.onExit(() => finishChannel(state))

  const send = (message: { id?: RequestID; method: string; params?: unknown }) => {
    if (state.closed) throw new CodexChannelClosedError()
    process.write(`${JSON.stringify(message)}\n`)
  }

  // Unclaimed server requests are refused because an unanswered approval holds the Turn forever.
  return {
    invalidMessageCount: () => state.invalidMessageCount,
    notify(method) {
      send({ method })
    },
    request(method, params, decode) {
      if (state.closed) return Promise.reject(new CodexChannelClosedError())
      const id = ++sequence
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          state.pending.delete(id)
          reject(new CodexRequestTimeoutError(method))
        }, requestTimeoutMs)
        timer.unref()
        state.pending.set(id, {
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
        send({ id, method, params })
      })
    },
    respond(id, result) {
      if (state.closed) throw new CodexChannelClosedError()
      process.write(`${JSON.stringify({ id, result })}\n`)
    },
    onNotification(listener) {
      state.notificationListeners.push(listener)
    },
    onExit(listener) {
      state.exitListeners.push(listener)
    },
    close() {
      lines.close()
      finishChannel(state)
      process.kill()
    },
  }
}

type CodexExecutable = {
  executable: string
  version: string
}

export type CodexAppServerClientOptions = {
  resolveExecutable?: (signal: AbortSignal) => Promise<CodexExecutable | null>
  openChannel?: (executable: string) => CodexChannel
}

export type CodexAppServerClient = {
  request: CodexRequest
  respond: (id: RequestID, result: unknown) => void
  onNotification: (listener: (message: WireMessage) => boolean | undefined) => () => void
  shutdown: () => void
}

function openProcess(executable: string): CodexChannel {
  const environment = {
    ...process.env,
  }
  delete environment.OPENAI_API_KEY
  delete environment.CODEX_API_KEY
  const child = spawn(
    executable,
    ['app-server', '--listen', 'stdio://', '-c', 'features.default_mode_request_user_input=true'],
    {
      env: environment,
      stdio: ['pipe', 'pipe', 'pipe'],
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
      child.once('close', listener)
      child.once('error', listener)
    },
  })
}

async function resolveCodexExecutable(signal: AbortSignal): Promise<CodexExecutable | null> {
  const executable =
    process.env[SESSION_CODEX_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('codex')
  // An empty override pins a machine with no Codex, as the sign-in override does.
  if (!executable) return null
  const version = await executableVersion(executable)
  if (signal.aborted) throw signal.reason
  return {
    executable,
    version,
  }
}

function resolveBeforeAbort(
  resolveExecutable: (signal: AbortSignal) => Promise<CodexExecutable | null>,
  signal: AbortSignal,
): Promise<CodexExecutable | null> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const stop = () => {
      signal.removeEventListener('abort', stop)
      reject(signal.reason)
    }
    signal.addEventListener('abort', stop, { once: true })
    void resolveExecutable(signal).then(
      (value) => {
        signal.removeEventListener('abort', stop)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', stop)
        reject(error)
      },
    )
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

class CodexAppServerClientInstance implements CodexAppServerClient {
  private readonly abort = new AbortController()
  private readonly notificationListeners = new Set<(message: WireMessage) => boolean | undefined>()
  private readonly openChannel: (executable: string) => CodexChannel
  private readonly resolveExecutable: (signal: AbortSignal) => Promise<CodexExecutable | null>
  private channel: CodexChannel | null = null
  private closed = false
  private connecting: Promise<CodexChannel> | null = null
  private generation = 0
  private identity: CodexExecutable | null = null
  private retryCount = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(options: CodexAppServerClientOptions) {
    this.resolveExecutable = options.resolveExecutable ?? resolveCodexExecutable
    this.openChannel = options.openChannel ?? openProcess
  }

  readonly request: CodexRequest = async (method, params, parse) => {
    const current = await this.connect()
    return current.request(method, params, parse)
  }

  respond(id: RequestID, result: unknown) {
    if (this.closed) throw new Error('Codex app-server is closed.')
    if (this.channel === null) throw new Error('Codex app-server is unavailable.')
    this.channel.respond(id, result)
  }

  onNotification(listener: (message: WireMessage) => boolean | undefined) {
    this.notificationListeners.add(listener)
    return () => this.notificationListeners.delete(listener)
  }

  shutdown() {
    if (this.closed) return
    this.closed = true
    this.generation += 1
    this.clearRetry()
    this.abort.abort(new Error('Codex app-server is closed.'))
    this.closeChannel()
  }

  private clearRetry() {
    if (this.retryTimer === null) return
    clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private scheduleReconnect = () => {
    if (this.closed || this.retryTimer !== null) return
    this.retryCount += 1
    const timer = setTimeout(
      () => {
        if (this.retryTimer === timer) this.retryTimer = null
        void this.connect().catch(this.scheduleReconnect)
      },
      Math.min(1_000 * 2 ** this.retryCount, 30_000),
    )
    timer.unref()
    this.retryTimer = timer
  }

  private closeChannel() {
    const current = this.channel
    this.channel = null
    this.identity = null
    current?.close()
  }

  private connect(): Promise<CodexChannel> {
    if (this.closed) return Promise.reject(new Error('Codex app-server is closed.'))
    if (this.connecting !== null) return this.connecting
    this.clearRetry()
    const pending = this.createConnection(this.generation)
    this.connecting = pending
    void pending.then(
      () => this.clearConnecting(pending),
      () => this.clearConnecting(pending),
    )
    return pending
  }

  private clearConnecting(pending: Promise<CodexChannel>) {
    if (this.connecting === pending) this.connecting = null
  }

  private async createConnection(currentGeneration: number): Promise<CodexChannel> {
    const resolved = await resolveBeforeAbort(this.resolveExecutable, this.abort.signal)
    this.assertActive(currentGeneration)
    if (resolved === null) {
      this.closeChannel()
      throw new CodexUnavailableError()
    }
    if (this.matchesCurrent(resolved)) return this.channel as CodexChannel
    this.closeChannel()
    return this.openResolved(resolved, currentGeneration)
  }

  private matchesCurrent(resolved: CodexExecutable) {
    return (
      this.channel !== null &&
      this.identity?.executable === resolved.executable &&
      this.identity.version === resolved.version
    )
  }

  private async openResolved(
    resolved: CodexExecutable,
    currentGeneration: number,
  ): Promise<CodexChannel> {
    let opened: CodexChannel | null = null
    try {
      opened = this.openChannel(resolved.executable)
      this.channel = opened
      this.wireChannel(opened)
      await handshake(opened)
    } catch (error) {
      if (opened !== null && this.channel === opened) this.closeChannel()
      this.scheduleReconnect()
      throw error
    }
    this.assertActive(currentGeneration, opened)
    this.identity = resolved
    this.retryCount = 0
    return opened
  }

  private wireChannel(opened: CodexChannel) {
    opened.onNotification((message) => {
      let claimed = false
      for (const listener of this.notificationListeners) {
        if (listener(message) === true) claimed = true
      }
      return claimed
    })
    opened.onExit(() => {
      if (this.channel !== opened) return
      this.channel = null
      this.identity = null
      this.scheduleReconnect()
    })
  }

  private assertActive(currentGeneration: number, opened?: CodexChannel) {
    if (!this.closed && currentGeneration === this.generation) return
    opened?.close()
    throw new Error('Codex app-server is closed.')
  }
}

export function createCodexAppServerClient(
  options: CodexAppServerClientOptions = {},
): CodexAppServerClient {
  return new CodexAppServerClientInstance(options)
}
