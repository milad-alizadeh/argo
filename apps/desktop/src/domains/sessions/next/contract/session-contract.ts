import { z } from 'zod'

export const HARNESSES = ['claude', 'codex'] as const
export const harnessSchema = z.enum(HARNESSES)
export type Harness = z.infer<typeof harnessSchema>

export const sessionIdentitySchema = z.strictObject({
  harness: harnessSchema,
  nativeId: z.string().min(1),
})
export type SessionIdentity = z.infer<typeof sessionIdentitySchema>

export const sessionPostureSchema = z.enum(['managed', 'watched'])
export type SessionPosture = z.infer<typeof sessionPostureSchema>

export const sourceHealthSchema = z.enum(['ready', 'unavailable'])
export type SourceHealth = z.infer<typeof sourceHealthSchema>

const startCommandSchema = z.strictObject({
  type: z.literal('session.start'),
  harness: harnessSchema,
  cwd: z.string().min(1),
  prompt: z.string().trim().min(1),
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
})
export type SessionProjection = z.infer<typeof sessionProjectionSchema>

// A Harness owns its vendor integration; shared Session code sees only validated product messages.
export type SessionAdapter = {
  execute: (command: SessionCommand) => Promise<SessionProjection>
}
