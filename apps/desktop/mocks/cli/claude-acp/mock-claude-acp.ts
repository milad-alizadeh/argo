// A stand-in ACP agent for the packaged proofs, run by node's type stripping. It speaks ACP on stdio
// and keeps each Session's updates where `session/load` can replay them in a new process.

import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Readable, Writable } from 'node:stream'
import {
  agent,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  RequestError,
  type SessionConfigOption,
  type SessionUpdate,
} from '@agentclientprotocol/sdk'
import { readMockReplyDelayMs } from '@/harnesses/proof-protocol'
import { MOCK_CLAUDE_ACP_PROCESS_TITLE } from '../mock-cli-process-titles.mts'
import recorded from './fixtures/session-discovery-0.84.0.json' with { type: 'json' }
import { mockClaudeAcpFolder, mockClaudeAcpReply } from './mock-claude-acp-transcripts.ts'

process.title = MOCK_CLAUDE_ACP_PROCESS_TITLE

const folder = mockClaudeAcpFolder(process.argv[2] ?? process.cwd())
const REPLY_DELAY_MS = readMockReplyDelayMs()
const options = JSON.parse(readFileSync(process.argv[3] ?? '', 'utf8'))
function record(method: string) {
  if (options.requestLog !== undefined)
    appendFileSync(options.requestLog, `${JSON.stringify({ method })}\n`)
}
// A test's agent entry sets these to play an agent that differs from the default one.
const behaviour = {
  // Answers `session/new` with auth_required until a sign-in has run once in this folder.
  needsLogin: process.env.MOCK_ACP_NEEDS_LOGIN === '1',
  // `terminal` signs in as claude-agent-acp 0.84.0 does: a relaunch with the method's args.
  loginMethod: process.env.MOCK_ACP_LOGIN_METHOD === 'terminal' ? 'terminal' : 'agent',
  loadSession: process.env.MOCK_ACP_NO_LOAD_SESSION !== '1',
  // Config option categories to report with a value no client can read.
  unreadable: (process.env.MOCK_ACP_UNREADABLE_OPTIONS ?? '').split(',').filter(Boolean),
  // Config option categories to leave out.
  omitted: (process.env.MOCK_ACP_OMITTED_OPTIONS ?? '').split(',').filter(Boolean),
}
const capabilities = options.capabilities ?? {
  ...recorded.initialize.result.agentCapabilities,
  loadSession: behaviour.loadSession,
}
const LOGIN_METHOD = { id: 'mock-login', name: 'Mock login' }
const TERMINAL_LOGIN_ARGS = ['--cli', 'auth', 'login', '--claudeai']
const TERMINAL_LOGIN_METHOD = {
  id: 'claude-ai-login',
  name: 'Claude Subscription',
  type: 'terminal' as const,
  args: TERMINAL_LOGIN_ARGS,
}
const signedInFile = () => path.join(folder, 'signed-in')
// The mock names each option after its category, as the real agent does for mode and model.
const select = (
  category: string,
  currentValue: string,
  values: readonly string[],
): SessionConfigOption => ({
  id: category,
  name: category,
  category,
  type: 'select',
  currentValue,
  options: values.map((value) => ({ value, name: value })),
})
type Config = { mode: string; model: string; thought_level: string }
const OPENING: Config = { mode: 'default', model: 'sonnet', thought_level: 'medium' }
// Like the real agent, a model without effort stops reporting the effort option.
const NO_EFFORT_MODELS = ['haiku']

function configOptions(config: Config): SessionConfigOption[] {
  return [
    select('mode', config.mode, ['default', 'acceptEdits', 'plan', 'bypassPermissions']),
    select('model', config.model, ['sonnet', 'opus', 'haiku']),
    ...(NO_EFFORT_MODELS.includes(config.model)
      ? []
      : [select('thought_level', config.thought_level, ['low', 'medium', 'high'])]),
  ]
    .filter((option) => !behaviour.omitted.includes(option.category ?? ''))
    .map((option) =>
      behaviour.unreadable.includes(option.category ?? '')
        ? ({ ...option, currentValue: 7 } as unknown as SessionConfigOption)
        : option,
    )
}

function reported(config: Config, configId: string): configId is keyof Config {
  return configOptions(config).some(({ id }) => id === configId)
}

type Stored = { cwd: string; updates: SessionUpdate[] }
const open = new Map<string, AbortController | null>()
const configs = new Map<string, Config>()

function sessionFile(sessionId: string) {
  return path.join(folder, `${sessionId}.json`)
}

function read(sessionId: string): Stored | null {
  const file = sessionFile(sessionId)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Stored) : null
}

function append(sessionId: string, update: SessionUpdate) {
  const stored = read(sessionId)
  if (stored === null) throw RequestError.resourceNotFound(sessionId)
  stored.updates.push(update)
  writeFileSync(sessionFile(sessionId), JSON.stringify(stored))
}

function known(sessionId: string): Stored {
  const stored = read(sessionId)
  if (stored === null) throw RequestError.resourceNotFound(sessionId)
  return stored
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, REPLY_DELAY_MS)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

mkdirSync(folder, { recursive: true })
if (process.argv.slice(4).join(' ') === TERMINAL_LOGIN_ARGS.join(' ')) {
  // The real login bills an inherited API key, so a relaunch that keeps one fails here.
  if (process.env.ANTHROPIC_API_KEY !== undefined) process.exit(1)
  writeFileSync(signedInFile(), '')
  process.exit(0)
}
// The real agent offers a terminal method only to a client that says it can run one.
function authMethods(terminalAllowed: boolean) {
  if (!behaviour.needsLogin) return []
  if (behaviour.loginMethod === 'agent') return [LOGIN_METHOD]
  return terminalAllowed ? [TERMINAL_LOGIN_METHOD] : []
}
const connection = agent({ name: 'mock-claude-agent-acp' })
  .onRequest(methods.agent.initialize, ({ params }) => ({
    protocolVersion: PROTOCOL_VERSION,
    agentCapabilities: capabilities,
    agentInfo: { name: 'mock-claude-agent-acp', version: '0.0.0' },
    authMethods: authMethods(params.clientCapabilities?.auth?.terminal === true),
  }))
  .onRequest(methods.agent.session.list, ({ params }) => {
    record('session/list')
    if (capabilities.sessionCapabilities?.list == null)
      throw RequestError.methodNotFound('session/list')
    if (options.listing !== undefined) return options.listing
    const sessions = readdirSync(folder).flatMap((name) => {
      if (!name.endsWith('.json')) return []
      const sessionId = name.slice(0, -5)
      const stored = known(sessionId)
      const prompt = stored.updates.find((update) => update.sessionUpdate === 'user_message_chunk')
      if (prompt?.sessionUpdate !== 'user_message_chunk' || prompt.content.type !== 'text')
        return []
      return [{ sessionId, cwd: stored.cwd, title: prompt.content.text }]
    })
    const offset = Number(params.cursor ?? 0)
    return {
      sessions: sessions.slice(offset, offset + 1),
      ...(offset + 1 < sessions.length ? { nextCursor: String(offset + 1) } : {}),
    }
  })
  .onRequest(methods.agent.authenticate, ({ params }) => {
    if (behaviour.loginMethod !== 'agent' || params.methodId !== LOGIN_METHOD.id)
      throw RequestError.invalidParams(params)
    writeFileSync(signedInFile(), '')
    return {}
  })
  .onRequest(methods.agent.session.new, ({ params }) => {
    if (behaviour.needsLogin && !existsSync(signedInFile())) throw RequestError.authRequired()
    const sessionId = randomUUID()
    writeFileSync(sessionFile(sessionId), JSON.stringify({ cwd: params.cwd, updates: [] }))
    open.set(sessionId, null)
    configs.set(sessionId, { ...OPENING })
    return { sessionId, configOptions: configOptions(OPENING) }
  })
  .onRequest(methods.agent.session.load, async ({ params, client }) => {
    record('session/load')
    if (!capabilities.loadSession) throw RequestError.methodNotFound('session/load')
    const stored = known(params.sessionId)
    for (const update of stored.updates)
      await client.notify(methods.client.session.update, { sessionId: params.sessionId, update })
    open.set(params.sessionId, null)
    configs.set(params.sessionId, { ...OPENING })
    return { configOptions: configOptions(OPENING) }
  })
  .onRequest(methods.agent.session.resume, ({ params }) => {
    record('session/resume')
    if (capabilities.sessionCapabilities?.resume == null)
      throw RequestError.methodNotFound('session/resume')
    known(params.sessionId)
    open.set(params.sessionId, null)
    configs.set(params.sessionId, { ...OPENING })
    return { configOptions: configOptions(OPENING) }
  })
  .onRequest(methods.agent.session.setConfigOption, ({ params }) => {
    const config = configs.get(params.sessionId)
    if (config === undefined) throw RequestError.resourceNotFound(params.sessionId)
    if (!reported(config, params.configId) || typeof params.value !== 'string')
      throw RequestError.internalError({ details: `Unknown config option: ${params.configId}` })
    config[params.configId] = params.value
    return { configOptions: configOptions(config) }
  })
  .onRequest(methods.agent.session.close, ({ params }) => {
    record('session/close')
    if (capabilities.sessionCapabilities?.close == null)
      throw RequestError.methodNotFound('session/close')
    open.get(params.sessionId)?.abort()
    open.delete(params.sessionId)
    return {}
  })
  .onRequest(methods.agent.session.prompt, async ({ params, client }) => {
    if (!open.has(params.sessionId)) throw RequestError.resourceNotFound(params.sessionId)
    const text = params.prompt
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
    const turn = new AbortController()
    open.set(params.sessionId, turn)
    const messageId = randomUUID()
    const notify = async (update: SessionUpdate) => {
      append(params.sessionId, update)
      await client.notify(methods.client.session.update, { sessionId: params.sessionId, update })
    }
    append(params.sessionId, {
      sessionUpdate: 'user_message_chunk',
      messageId: randomUUID(),
      content: { type: 'text', text },
    })
    if (text === 'Request ACP permission') {
      const answer = await client
        .request(
          methods.client.session.requestPermission,
          {
            sessionId: params.sessionId,
            toolCall: {
              toolCallId: 'acp-permission',
              title: 'Read the ACP proof file',
              kind: 'read',
              status: 'pending',
            },
            options: options.permissionOptions ?? [
              { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
              { optionId: 'deny', name: 'Deny', kind: 'reject_once' },
            ],
          },
          { cancellationSignal: turn.signal },
        )
        .catch(() => ({ outcome: { outcome: 'cancelled' as const } }))
      if (answer.outcome.outcome === 'cancelled' || answer.outcome.optionId !== 'allow')
        return { stopReason: 'cancelled' as const }
    }
    const reply = mockClaudeAcpReply(text)
    const half = Math.ceil(reply.length / 2)
    await notify({
      sessionUpdate: 'agent_message_chunk',
      messageId,
      content: { type: 'text', text: reply.slice(0, half) },
    })
    await pause(turn.signal)
    if (turn.signal.aborted) return { stopReason: 'cancelled' as const }
    await notify({
      sessionUpdate: 'agent_message_chunk',
      messageId,
      content: { type: 'text', text: reply.slice(half) },
    })
    open.set(params.sessionId, null)
    return { stopReason: 'end_turn' as const }
  })
  .onNotification(methods.agent.session.cancel, ({ params }) => {
    record('session/cancel')
    open.get(params.sessionId)?.abort()
  })
  .connect(
    ndJsonStream(
      Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
      Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
    ),
  )

await connection.closed
