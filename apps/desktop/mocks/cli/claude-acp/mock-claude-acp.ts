// A stand-in ACP agent for the packaged proofs, run by node's type stripping. It speaks ACP on stdio
// and keeps each Session's updates where `session/load` can replay them in a new process.

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
import { mockClaudeAcpFolder, mockClaudeAcpReply } from './mock-claude-acp-transcripts.ts'

process.title = MOCK_CLAUDE_ACP_PROCESS_TITLE

const folder = mockClaudeAcpFolder(process.argv[2] ?? process.cwd())
const REPLY_DELAY_MS = readMockReplyDelayMs()
// A test's agent entry sets these to play an agent that differs from the default one.
const behaviour = {
  // Answers `session/new` with auth_required until `authenticate` has run once in this folder.
  needsLogin: process.env.MOCK_ACP_NEEDS_LOGIN === '1',
  loadSession: process.env.MOCK_ACP_NO_LOAD_SESSION !== '1',
  // Config option categories to report with a value no client can read.
  unreadable: (process.env.MOCK_ACP_UNREADABLE_OPTIONS ?? '').split(',').filter(Boolean),
  // Config option categories to leave out.
  omitted: (process.env.MOCK_ACP_OMITTED_OPTIONS ?? '').split(',').filter(Boolean),
}
const LOGIN_METHOD = { id: 'mock-login', name: 'Mock login' }
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
const connection = agent({ name: 'mock-claude-agent-acp' })
  .onRequest(methods.agent.initialize, () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentCapabilities: {
      loadSession: behaviour.loadSession,
      sessionCapabilities: { resume: {}, close: {} },
    },
    agentInfo: { name: 'mock-claude-agent-acp', version: '0.0.0' },
    authMethods: behaviour.needsLogin ? [LOGIN_METHOD] : [],
  }))
  .onRequest(methods.agent.authenticate, ({ params }) => {
    if (params.methodId !== LOGIN_METHOD.id) throw RequestError.invalidParams(params)
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
    if (!behaviour.loadSession) throw RequestError.methodNotFound(methods.agent.session.load)
    const stored = known(params.sessionId)
    for (const update of stored.updates)
      await client.notify(methods.client.session.update, { sessionId: params.sessionId, update })
    open.set(params.sessionId, null)
    configs.set(params.sessionId, { ...OPENING })
    return { configOptions: configOptions(OPENING) }
  })
  .onRequest(methods.agent.session.resume, ({ params }) => {
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
    open.get(params.sessionId)?.abort()
  })
  .connect(
    ndJsonStream(
      Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
      Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
    ),
  )

await connection.closed
