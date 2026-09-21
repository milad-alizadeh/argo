import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

export const HARNESSES = ['claude', 'codex'] as const
export const harnessSchema = z.enum(HARNESSES)
export type Harness = z.infer<typeof harnessSchema>

export const sessionIdentitySchema = z.strictObject({
  harness: harnessSchema,
  nativeId: z.string().min(1),
})
export type SessionIdentity = z.infer<typeof sessionIdentitySchema>

export const workspaceReferenceSchema = z.strictObject({ id: identifierSchema })
export type WorkspaceReference = z.infer<typeof workspaceReferenceSchema>

export const agentSchema = z.strictObject({
  id: identifierSchema,
  parentId: identifierSchema.nullable(),
  workspace: workspaceReferenceSchema.nullable(),
})
export type Agent = z.infer<typeof agentSchema>

export function workspaceForAgent(agent: Agent, agents: Agent[]): WorkspaceReference | null {
  const byId = new Map(agents.map((candidate) => [candidate.id, candidate]))
  const visited = new Set<string>()
  let current: Agent | undefined = agent
  while (current !== undefined && !visited.has(current.id)) {
    if (current.workspace !== null) return current.workspace
    visited.add(current.id)
    current = current.parentId === null ? undefined : byId.get(current.parentId)
  }
  return null
}

export const sessionPostureSchema = z.enum(['managed', 'watched'])
export type SessionPosture = z.infer<typeof sessionPostureSchema>

export const sourceHealthSchema = z.enum(['ready', 'unavailable'])
export type SourceHealth = z.infer<typeof sourceHealthSchema>

const mainWorkspaceSelectionSchema = z.strictObject({ kind: z.literal('main') })
const existingWorkspaceSelectionSchema = z.strictObject({
  kind: z.literal('existing'),
  workspaceId: identifierSchema,
})
const newWorkspaceSelectionSchema = z.strictObject({
  kind: z.literal('new'),
  baseRef: identifierSchema,
})
export const workspaceSelectionSchema = z.discriminatedUnion('kind', [
  mainWorkspaceSelectionSchema,
  existingWorkspaceSelectionSchema,
  newWorkspaceSelectionSchema,
])
export type WorkspaceSelection = z.infer<typeof workspaceSelectionSchema>

const startCommandSchema = z.strictObject({
  type: z.literal('session.start'),
  harness: harnessSchema,
  prompt: z.string().trim().min(1),
  workspace: workspaceSelectionSchema,
})
const sendCommandSchema = z.strictObject({
  type: z.literal('session.send'),
  session: sessionIdentitySchema,
  prompt: z.string().trim().min(1),
})
const interruptCommandSchema = z.strictObject({
  type: z.literal('session.interrupt'),
  session: sessionIdentitySchema,
})

export const sessionCommandSchema = z.discriminatedUnion('type', [
  startCommandSchema,
  sendCommandSchema,
  interruptCommandSchema,
])
export type SessionCommand = z.infer<typeof sessionCommandSchema>

export const sessionCapabilitiesSchema = z.strictObject({
  start: z.boolean(),
  send: z.boolean(),
  interrupt: z.boolean(),
})
export type SessionCapabilities = z.infer<typeof sessionCapabilitiesSchema>

const capabilities: SessionCapabilities = { start: true, send: true, interrupt: true }
const capabilitiesByHarness = {
  claude: capabilities,
  codex: capabilities,
} satisfies Record<Harness, SessionCapabilities>

export function capabilitiesFor(harness: Harness): SessionCapabilities {
  return capabilitiesByHarness[harness]
}

export const sessionProjectionSchema = z.strictObject({
  session: sessionIdentitySchema,
  posture: sessionPostureSchema,
  sourceHealth: sourceHealthSchema,
  revision: z.number().int().nonnegative(),
  workspace: workspaceReferenceSchema.nullable(),
})
export type SessionProjection = z.infer<typeof sessionProjectionSchema>

// A Harness owns its vendor integration; shared Session code sees only validated product messages.
export type SessionAdapter = {
  execute: (command: SessionCommand) => Promise<SessionProjection>
}
