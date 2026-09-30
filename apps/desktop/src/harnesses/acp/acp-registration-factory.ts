import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SessionUpdate } from '@agentclientprotocol/sdk'
import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import type { Harness } from '@/harnesses/harness'
import { type HarnessInfo, unavailable } from '@/harnesses/harness-catalog'
import type { HarnessRegistration } from '@/harnesses/registration'
import { type AcpCatalogPresentation, acpHarnessInfo } from './acp-catalog'
import { type AcpAgentCommand, AcpCapabilityError, connectAcpAgent } from './acp-client'
import { AcpFeedProjection } from './acp-feed-projection'
import { AcpSessionChannel, acpPermissionOutcome } from './acp-session-channel'

// What a concrete ACP Harness supplies; the factory turns it into a registration.
export type AcpHarnessDefinition<Id extends Harness> = HarnessReadinessRegistration & {
  harness: Id
  // Where to start the agent, or null when it is not installed.
  command: () => AcpAgentCommand | null
  catalog: AcpCatalogPresentation
}

const noUpdates = () => {}
const refusePermission = async (request: Parameters<typeof acpPermissionOutcome>[0]) =>
  acpPermissionOutcome(request, 'cancel')

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
    update: (sessionId, update) => {
      if (sessionId === target.nativeId) updates.push(update)
    },
    requestPermission: refusePermission,
  })
  try {
    if (!client.capabilities.loadSession) throw new AcpCapabilityError('session/load')
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

// The catalog is what a fresh Session reports; unprompted, it is never stored, and it is closed when advertised.
async function readAcpCatalog(
  harness: Harness,
  command: AcpAgentCommand | null,
  presentation: AcpCatalogPresentation,
): Promise<HarnessInfo> {
  if (command === null) return unavailable(harness)
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-acp-catalog-'))
  const client = await connectAcpAgent(command, {
    update: noUpdates,
    requestPermission: refusePermission,
  })
  try {
    const session = await client.newSession(directory)
    if (client.capabilities.closeSession) await client.closeSession(session.sessionId)
    return acpHarnessInfo(harness, session.configOptions, presentation)
  } finally {
    client.close()
    await rm(directory, { recursive: true, force: true })
  }
}

function required(command: AcpAgentCommand | null, harness: Harness): AcpAgentCommand {
  if (command === null) throw new Error(`The ${harness} ACP agent is not installed.`)
  return command
}

export function createAcpRegistration<Id extends Harness>(
  definition: AcpHarnessDefinition<Id>,
): HarnessRegistration<Id> {
  const { harness, command, catalog } = definition
  return {
    harness,
    checkReadiness: definition.checkReadiness,
    signIn: definition.signIn,
    readCatalog: () => readAcpCatalog(harness, command(), catalog),
    readHistory: (target) => readAcpHistory(required(command(), harness), target),
    openLiveSession: (input, controls, emit) =>
      new AcpSessionChannel(input, emit, { command: required(command(), harness), controls }),
    // Discovery through `session/list` lands with #2803; until then nothing is listed.
    sessionDiscovery: async () => ({ records: [], skipped: 0 }),
    changeableTurnSettings: ['model', 'effort', 'mode'],
    acceptsAttachments: false,
  }
}
