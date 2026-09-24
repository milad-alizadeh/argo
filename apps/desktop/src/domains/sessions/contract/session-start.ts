import { z } from 'zod'
import {
  harnessSchema,
  workspaceSelectionSchema,
} from '@/domains/sessions/next/contract/session-contract'

export const sessionStartInputSchema = z.strictObject({
  harness: harnessSchema,
  prompt: z.string().trim().min(1),
  workspace: workspaceSelectionSchema,
  setup: z.unknown().optional(),
  startTurn: z.boolean().optional(),
})
export type SessionStartInput = z.infer<typeof sessionStartInputSchema>

export const sessionStartOutputSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('started'), argoId: z.uuid() }),
  z.strictObject({ kind: z.literal('uncertain') }),
  z.strictObject({ kind: z.literal('rejected'), reason: z.string().min(1) }),
])
export type SessionStartOutput = z.infer<typeof sessionStartOutputSchema>
