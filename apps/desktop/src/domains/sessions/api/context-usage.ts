import { z } from 'zod'

// How full a Session's context window was after its newest Turn, as the Harness reported it.
export const contextUsageSchema = z.strictObject({
  usedTokens: z.number().int().nonnegative(),
  // Null when the Harness reported no window size.
  windowTokens: z.number().int().positive().nullable(),
})
export type ContextUsage = z.infer<typeof contextUsageSchema>
