import { z } from 'zod'
import {
  type Harness,
  harnessSchema,
  sessionIdentitySchema,
  workspaceSelectionSchema,
} from '@/domains/sessions/next/contract/session-contract'
import { identifierSchema } from '@/shared/validation'

const startCommandSchema = z.strictObject({
  type: z.literal('session.start'),
  harness: harnessSchema,
  prompt: z.string().trim().min(1),
  startTurn: z.boolean().optional(),
  workspace: workspaceSelectionSchema,
})
const sendCommandSchema = z.strictObject({
  type: z.literal('session.send'),
  session: sessionIdentitySchema,
  prompt: z.string().trim().min(1),
})
const steerCommandSchema = z.strictObject({
  type: z.literal('session.steer'),
  session: sessionIdentitySchema,
  prompt: z.string().trim().min(1),
})
const interruptCommandSchema = z.strictObject({
  type: z.literal('session.interrupt'),
  session: sessionIdentitySchema,
})
const decideCommandSchema = z.strictObject({
  type: z.literal('session.decide'),
  session: sessionIdentitySchema,
  approvalId: identifierSchema,
  decision: z.enum(['approve', 'reject']),
})
const answerCommandSchema = z.strictObject({
  type: z.literal('session.answer'),
  session: sessionIdentitySchema,
  questionId: identifierSchema,
  answer: z.string().trim().min(1),
})
const renameCommandSchema = z.strictObject({
  type: z.literal('session.rename'),
  session: sessionIdentitySchema,
  title: z.string().trim().min(1),
})
const compactCommandSchema = z.strictObject({
  type: z.literal('session.compact'),
  session: sessionIdentitySchema,
})
const closeCommandSchema = z.strictObject({
  type: z.literal('session.close'),
  session: sessionIdentitySchema,
})

export const sessionCommandSchema = z.discriminatedUnion('type', [
  startCommandSchema,
  sendCommandSchema,
  steerCommandSchema,
  interruptCommandSchema,
  decideCommandSchema,
  answerCommandSchema,
  renameCommandSchema,
  compactCommandSchema,
  closeCommandSchema,
])
export type SessionCommand = z.infer<typeof sessionCommandSchema>

export const sessionCapabilitiesSchema = z.strictObject({
  start: z.boolean(),
  send: z.boolean(),
  steer: z.boolean(),
  interrupt: z.boolean(),
  decide: z.boolean(),
  answer: z.boolean(),
  rename: z.boolean(),
  compact: z.boolean(),
  close: z.boolean(),
})
export type SessionCapabilities = z.infer<typeof sessionCapabilitiesSchema>

const capabilitiesByHarness = {
  // The SDK has no dedicated compact method, but the managed Claude channel accepts Claude's
  // `/compact` command through the same user-message stream as the interactive CLI.
  claude: {
    start: true,
    send: true,
    steer: true,
    interrupt: true,
    decide: true,
    answer: true,
    rename: true,
    compact: true,
    close: true,
  },
  codex: {
    start: true,
    send: true,
    steer: true,
    interrupt: true,
    decide: true,
    answer: true,
    rename: true,
    compact: true,
    close: true,
  },
} satisfies Record<Harness, SessionCapabilities>

export function capabilitiesFor(harness: Harness): SessionCapabilities {
  return capabilitiesByHarness[harness]
}
