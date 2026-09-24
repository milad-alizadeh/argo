import { z } from 'zod'
import { harnessSchema } from '@/domains/sessions/next/contract/session-contract'

export const sessionListInputSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
})

export const sessionListItemSchema = z.strictObject({
  argoId: z.uuid(),
  harness: harnessSchema,
  title: z.string().nullable(),
})

export const sessionListOutputSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(sessionListItemSchema),
})

export type SessionListResult = z.infer<typeof sessionListOutputSchema>
