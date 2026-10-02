import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SessionUpdate } from '@agentclientprotocol/sdk'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import type { HarnessSignInDriver } from '@/domains/harness-signin/main'
import type { HarnessSignInOutcome } from '@/domains/harness-signin/main/harness-sign-in'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import type { Harness } from '@/harnesses/harness'
import { type HarnessInfo, notInstalled } from '@/harnesses/harness-catalog'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { runLoginProcess } from '@/harnesses/host/run-login-process'
import type { HarnessRegistration } from '@/harnesses/registration'
import { type AcpAgentEntry, type AcpHarness, byAcpAgent } from './acp-agents'
import { acpHarnessInfo } from './acp-catalog'
import {
  type AcpAgentCommand,
  type AcpAuthMethod,
  type AcpClient,
  connectAcpAgent,
  errorDetail,
  isAuthRequired,
} from './acp-client'
import { AcpFeedProjection } from './acp-feed-projection'
import { acpExecutableOverride } from './acp-proof-protocol'
import { AcpSessionChannel, acpPermissionOutcome } from './acp-session-channel'
import { listAcpSessions } from './acp-session-discovery'

const refusePermission = async (request: Parameters<typeof acpPermissionOutcome>[0]) =>
  acpPermissionOutcome(request, 'cancel')
const handlers = { update: () => {}, requestPermission: refusePermission }

function findAgentExecutable(agent: AcpAgentEntry): string | null {
  return (
    process.env[acpExecutableOverride(agent.id)] ??
    (path.isAbsolute(agent.command) ? agent.command : findExecutableOnLoginShellPath(agent.command))
  )
}

function agentCommand(agent: AcpAgentEntry, executable: string): AcpAgentCommand {
  const environment: NodeJS.ProcessEnv = { ...process.env, ...agent.env }
  for (const name of agent.unsetEnv ?? []) delete environment[name]
  // An agent may be a node script; a GUI launch's bare PATH must still find the node beside it.
  environment.PATH = [path.dirname(executable), environment.PATH]
    .filter(Boolean)
    .join(path.delimiter)
  return { executable, args: agent.args, env: environment }
}

// Vendor history is the agent's own `session/load` replay; Argo keeps no copy of it.
async function readAcpHistory(
  command: AcpAgentCommand,
  target: SessionHistoryTarget,
): Promise<FeedContent[]> {
  if (target.subagentId !== null) throw new Error('ACP history has no Subagent target.')
  // The agent finds a Session by its working directory, so a guess would load nothing.
  if (target.cwd === null) throw new Error('ACP history needs the Session working directory.')
  const cwd = target.cwd
  const updates: SessionUpdate[] = []
  const client = await connectAcpAgent(command, {
    ...handlers,
    update: (sessionId, update) => {
      if (sessionId === target.nativeId) updates.push(update)
    },
  })
  try {
    // An agent without `loadSession` keeps no history Argo can read, which is not a failure.
    if (!client.capabilities.loadSession) return []
    await client.loadSession(target.nativeId, cwd)
  } finally {
    client.close()
  }
  const projection = new AcpFeedProjection()
  const rows = new Map<string, FeedContent>()
  for (const update of updates) {
    const content = projection.project(update)
    if (content !== null) rows.set(content.id, content)
  }
  if (projection.rejected > 0)
    console.warn(`Rejected ${projection.rejected} unsupported ACP history update(s).`)
  return [...rows.values()]
}

type AcpProbe = { kind: 'ready'; configOptions: readonly unknown[] } | { kind: 'signed-out' }

// Opens a fresh Session in a scratch folder and closes it when advertised; it is never prompted.
async function probeAcpAgent(command: AcpAgentCommand): Promise<AcpProbe> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-acp-probe-'))
  try {
    const client = await connectAcpAgent(command, handlers)
    try {
      const session = await client.newSession(directory)
      if (client.capabilities.closeSession) await client.closeSession(session.sessionId)
      return { kind: 'ready', configOptions: session.configOptions }
    } finally {
      client.close()
    }
  } catch (error) {
    if (isAuthRequired(error)) return { kind: 'signed-out' }
    throw error
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function readAcpCatalog(
  agent: AcpAgentEntry<Harness>,
  command: AcpAgentCommand | null,
): Promise<HarnessInfo> {
  if (command === null) return notInstalled(agent.id, agent.installStep)
  const probe = await probeAcpAgent(command)
  if (probe.kind === 'signed-out')
    return { harness: agent.id, availability: 'unavailable', reason: 'not-signed-in' }
  const { info, rejected } = acpHarnessInfo(agent.id, probe.configOptions, agent.label)
  if (rejected > 0) console.warn(`Skipped ${rejected} unreadable ACP Turn setting(s).`)
  return info
}

async function readAcpReadiness(
  harness: Harness,
  command: AcpAgentCommand | null,
): Promise<HarnessReadiness> {
  if (command === null) return { harness, state: 'missing', detail: null }
  try {
    const probe = await probeAcpAgent(command)
    return { harness, state: probe.kind === 'ready' ? 'ready' : 'signed-out', detail: null }
  } catch (error) {
    // An agent that cannot start a Session reads as not installed, with the reason kept.
    console.warn(`The ${harness} ACP agent did not start a Session: ${errorDetail(error)}`)
    return { harness, state: 'missing', detail: errorDetail(error) }
  }
}

// Relaunches the agent with the method's args, headless; exit 0 means signed in.
function runTerminalSignIn(
  command: AcpAgentCommand,
  method: Extract<AcpAuthMethod, { kind: 'terminal' }>,
  signal: AbortSignal,
): Promise<HarnessSignInOutcome> {
  const child = spawn(command.executable, [...command.args, ...method.args], {
    env: { ...command.env, ...method.env },
    stdio: 'ignore',
  })
  return runLoginProcess(child, signal)
}

async function runAgentSignIn(
  client: AcpClient,
  method: Extract<AcpAuthMethod, { kind: 'agent' }>,
  signal: AbortSignal,
): Promise<HarnessSignInOutcome> {
  const cancel = () => client.close()
  signal.addEventListener('abort', cancel, { once: true })
  try {
    await client.authenticate(method.id)
    return 'completed'
  } catch (error) {
    if (signal.aborted) return 'canceled'
    console.warn(`The ACP agent sign-in failed: ${errorDetail(error)}`)
    return 'failed'
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}

// Runs a method the agent handles itself first, else the first terminal method it offers.
function acpSignInDriver(
  findCommand: () => AcpAgentCommand | null,
  checkReadiness: () => Promise<HarnessReadiness>,
): HarnessSignInDriver {
  return {
    checkReadiness,
    async login(signal) {
      const command = findCommand()
      if (command === null) return 'failed'
      const client = await connectAcpAgent(command, handlers).catch((error: unknown) => {
        console.warn(`The ACP agent did not start for sign-in: ${errorDetail(error)}`)
        return null
      })
      if (client === null) return 'failed'
      if (signal.aborted) {
        client.close()
        return 'canceled'
      }
      const method =
        client.authMethods.find(({ kind }) => kind === 'agent') ?? client.authMethods[0]
      try {
        if (method === undefined) {
          console.warn('The ACP agent offers no sign-in method.')
          return 'failed'
        }
        switch (method.kind) {
          case 'agent':
            return await runAgentSignIn(client, method, signal)
          case 'terminal':
            // The relaunch is a separate process, so this connection is done.
            client.close()
            return await runTerminalSignIn(command, method, signal)
        }
      } finally {
        client.close()
      }
    },
  }
}

function required(command: AcpAgentCommand | null, harness: Harness): AcpAgentCommand {
  if (command === null) throw new Error(`The ${harness} ACP agent is not installed.`)
  return command
}

export function createAcpRegistration<Id extends Harness>(
  agent: AcpAgentEntry<Id>,
): HarnessRegistration<Id> {
  const harness = agent.id
  let found: string | null = null
  // Cached once found and looked up again until then, so an install shows on the next read.
  const command = () => {
    found ??= findAgentExecutable(agent) || null
    return found === null ? null : agentCommand(agent, found)
  }
  const checkReadiness = () => readAcpReadiness(harness, command())
  return {
    harness,
    checkReadiness,
    signIn: acpSignInDriver(command, checkReadiness),
    readCatalog: () => readAcpCatalog(agent, command()),
    readHistory: async (target) => ({
      content: await readAcpHistory(required(command(), harness), target),
      complete: true,
    }),
    openLiveSession: (input, controls, emit) =>
      new AcpSessionChannel(input, emit, { command: required(command(), harness), controls }),
    listSessionSummaries: ({ knownNativeIds }) => listAcpSessions(command(), knownNativeIds),
    getSessionSummary: async (nativeId) => {
      const listing = await listAcpSessions(command(), [nativeId])
      if (listing.skipped > 0)
        console.warn(`Rejected ${listing.skipped} unsupported ACP Session summary(s).`)
      return listing.records.find((summary) => summary.nativeId === nativeId) ?? null
    },
    changeableTurnSettings: ['model', 'effort', 'mode'],
    acceptsAttachments: false,
  }
}

export function createAcpRegistrations() {
  // Each entry's registration carries that entry's own id, which `byAcpAgent` cannot type alone.
  return byAcpAgent((agent) => createAcpRegistration(agent)) as {
    [Id in AcpHarness]: HarnessRegistration<Id>
  }
}
