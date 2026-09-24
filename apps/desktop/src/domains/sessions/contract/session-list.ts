import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

const harnessSchema = z.enum(['claude', 'codex'])

export const sessionListInputSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
})

export const sessionListItemSchema = z.strictObject({
  argoId: identifierSchema,
  harness: harnessSchema,
  nativeId: identifierSchema,
  title: z.string().nullable(),
})

export const sessionListOutputSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(sessionListItemSchema),
})

export type SessionListResult = z.infer<typeof sessionListOutputSchema>
