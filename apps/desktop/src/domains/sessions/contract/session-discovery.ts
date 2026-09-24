import { z } from 'zod'
import { harnessSchema } from '@/domains/sessions/next/contract/session-contract'

export const discoveredSessionSchema = z.strictObject({
  harness: harnessSchema,
  nativeId: z.string().min(1),
  workspaceId: z.string().min(1),
  firstPrompt: z.string().nullable(),
})
export type DiscoveredSession = z.infer<typeof discoveredSessionSchema>
