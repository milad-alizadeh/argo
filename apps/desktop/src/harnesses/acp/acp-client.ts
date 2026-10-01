import { spawn } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import {
  type ClientContext,
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  RequestError,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionUpdate,
  type StopReason,
} from '@agentclientprotocol/sdk'
import { z } from 'zod'

// How to start one ACP agent process that speaks newline-delimited JSON-RPC on stdio.
export type AcpAgentCommand = {
  executable: string
  args: readonly string[]
  env: NodeJS.ProcessEnv
}

export type AcpClientHandlers = {
  update: (sessionId: string, update: SessionUpdate) => void
  requestPermission: (
    request: RequestPermissionRequest,
    signal: AbortSignal,
  ) => Promise<RequestPermissionResponse>
}

// Only the capabilities Argo branches on; everything else the agent advertises passes through.
const capabilitiesSchema = z.object({
  loadSession: z.boolean().optional(),
  sessionCapabilities: z
    .object({
      list: z.unknown().optional(),
      resume: z.unknown().optional(),
      close: z.unknown().optional(),
    })
    .nullish(),
})
const initializeSchema = z.object({
  protocolVersion: z.number().int(),
  agentCapabilities: capabilitiesSchema.optional(),
  // Each method is read alone (`authMethodsOf`), so one unreadable method skips only itself.
  authMethods: z.array(z.unknown()).optional(),
  agentInfo: z.object({ name: z.string(), version: z.string() }).nullish(),
})
// `AuthMethod` in the SDK's types.gen.d.ts: no `type` means `agent`, which `authenticate` runs.
const authMethodSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(['agent', 'terminal']).optional(),
})
// Each option is read where it is used (`acpConfigSelect`), so only the list is checked here.
const configOptionsSchema = z.object({ configOptions: z.array(z.unknown()).nullish() })
const sessionSchema = configOptionsSchema.extend({ sessionId: z.string().min(1) })
const configResponseSchema = z.object({ configOptions: z.array(z.unknown()) })
const promptSchema = z.object({
  stopReason: z.enum(['end_turn', 'max_tokens', 'max_turn_requests', 'refusal', 'cancelled']),
})

type AcpCapabilities = {
  loadSession: boolean
  listSessions: boolean
  resumeSession: boolean
  closeSession: boolean
}

type AcpAuthMethod = { id: string; name: string; runsInAgent: boolean }

type AcpSession = {
  sessionId: string
  configOptions: readonly unknown[]
}

export type AcpClient = {
  capabilities: AcpCapabilities
  authMethods: readonly AcpAuthMethod[]
  agentInfo: { name: string; version: string } | null
  authenticate: (methodId: string) => Promise<void>
  newSession: (cwd: string) => Promise<AcpSession>
  loadSession: (sessionId: string, cwd: string) => Promise<AcpSession>
  resumeSession: (sessionId: string, cwd: string) => Promise<AcpSession>
  prompt: (sessionId: string, text: string) => Promise<StopReason>
  cancel: (sessionId: string) => Promise<void>
  // Answers with every option the Session now reports; one choice can remove or change others.
  setConfigOption: (
    sessionId: string,
    configId: string,
    value: string,
  ) => Promise<readonly unknown[]>
  closeSession: (sessionId: string) => Promise<void>
  // Resolves when the agent process or its stream ends, for any reason.
  closed: Promise<void>
  close: () => void
}

class AcpCapabilityError extends Error {
  constructor(method: string) {
    super(`The ACP agent does not advertise ${method}.`)
  }
}

function capabilitiesOf(
  advertised: z.infer<typeof capabilitiesSchema> | undefined,
): AcpCapabilities {
  const session = advertised?.sessionCapabilities
  return {
    loadSession: advertised?.loadSession === true,
    listSessions: session?.list != null,
    resumeSession: session?.resume != null,
    closeSession: session?.close != null,
  }
}

const AUTH_REQUIRED = RequestError.authRequired().code

export function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// The agent's `auth_required` answer to a request it will not serve before a sign-in.
export function isAuthRequired(error: unknown): boolean {
  return error instanceof RequestError && error.code === AUTH_REQUIRED
}

function authMethodsOf(advertised: readonly unknown[] | undefined): AcpAuthMethod[] {
  const methods = (advertised ?? []).flatMap((method) => {
    const parsed = authMethodSchema.safeParse(method)
    return parsed.success ? [parsed.data] : []
  })
  const rejected = (advertised?.length ?? 0) - methods.length
  if (rejected > 0) console.warn(`Skipped ${rejected} unreadable ACP sign-in method(s).`)
  return methods.map(({ id, name, type }) => ({
    id,
    name,
    runsInAgent: type !== 'terminal',
  }))
}

function sessionOf(response: unknown): AcpSession {
  const parsed = sessionSchema.parse(response)
  return { sessionId: parsed.sessionId, configOptions: parsed.configOptions ?? [] }
}

// A load or resume answers without the Session id it was asked about.
function withSessionId(sessionId: string) {
  return (response: unknown) => ({
    sessionId,
    configOptions: configOptionsSchema.parse(response).configOptions ?? [],
  })
}

function sessionMethods(agent: ClientContext, capabilities: AcpCapabilities) {
  return {
    newSession: async (cwd: string) =>
      sessionOf(await agent.request(methods.agent.session.new, { cwd, mcpServers: [] })),
    loadSession: async (sessionId: string, cwd: string) => {
      if (!capabilities.loadSession) throw new AcpCapabilityError('session/load')
      return withSessionId(sessionId)(
        await agent.request(methods.agent.session.load, { sessionId, cwd, mcpServers: [] }),
      )
    },
    resumeSession: async (sessionId: string, cwd: string) => {
      if (!capabilities.resumeSession) throw new AcpCapabilityError('session/resume')
      return withSessionId(sessionId)(
        await agent.request(methods.agent.session.resume, { sessionId, cwd, mcpServers: [] }),
      )
    },
    prompt: async (sessionId: string, text: string) =>
      promptSchema.parse(
        await agent.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: 'text', text }],
        }),
      ).stopReason,
    cancel: (sessionId: string) => agent.notify(methods.agent.session.cancel, { sessionId }),
    setConfigOption: async (sessionId: string, configId: string, value: string) =>
      configResponseSchema.parse(
        await agent.request(methods.agent.session.setConfigOption, { sessionId, configId, value }),
      ).configOptions,
    closeSession: async (sessionId: string) => {
      if (!capabilities.closeSession) throw new AcpCapabilityError('session/close')
      await agent.request(methods.agent.session.close, { sessionId })
    },
  }
}

async function initialize(agent: ClientContext, exited: Promise<void>) {
  return initializeSchema.parse(
    await Promise.race([
      agent.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {},
        clientInfo: { name: 'argo', version: '1' },
      }),
      exited.then(() => {
        throw new Error('The ACP agent exited before it initialized.')
      }),
    ]),
  )
}

export async function connectAcpAgent(
  command: AcpAgentCommand,
  handlers: AcpClientHandlers,
): Promise<AcpClient> {
  const child = spawn(command.executable, [...command.args], {
    env: command.env,
    stdio: ['pipe', 'pipe', 'ignore'],
  })
  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => resolve())
    child.once('error', () => resolve())
  })
  const stream = ndJsonStream(
    Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
  )
  const connection = client({ name: 'argo' })
    .onNotification(methods.client.session.update, ({ params }) => {
      handlers.update(params.sessionId, params.update)
    })
    .onRequest(methods.client.session.requestPermission, ({ params, signal }) =>
      handlers.requestPermission(params, signal),
    )
    .connect(stream)
  const close = () => {
    connection.close()
    if (child.exitCode === null) child.kill()
  }
  const closed = Promise.race([connection.closed.catch(() => undefined), exited]).then(close)
  try {
    const initialized = await initialize(connection.agent, exited)
    const capabilities = capabilitiesOf(initialized.agentCapabilities)
    return {
      capabilities,
      authMethods: authMethodsOf(initialized.authMethods),
      agentInfo: initialized.agentInfo ?? null,
      authenticate: async (methodId) => {
        await connection.agent.request(methods.agent.authenticate, { methodId })
      },
      ...sessionMethods(connection.agent, capabilities),
      closed,
      close,
    }
  } catch (error) {
    close()
    throw error
  }
}
