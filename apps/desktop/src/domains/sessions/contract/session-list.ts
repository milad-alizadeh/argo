import { z } from 'zod'
import { harnessSchema } from '@/harnesses/harness'
import { sessionIngestionSchema } from './session-index'

export const sessionListInputSchema = z.strictObject({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  projectId: z.string().uuid().nullable().default(null),
  search: z.string().default(''),
})

export const sessionListItemSchema = sessionIngestionSchema.extend({
  argoId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
})

export const sessionListOutputSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  indexedTotal: z.number().int().nonnegative(),
  sessions: z.array(sessionListItemSchema),
})

export const sessionGetInputSchema = z.strictObject({ argoId: z.string().uuid() })
export const sessionGetOutputSchema = sessionListItemSchema.nullable()

export const sessionEnsureInputSchema = z.strictObject({
  harness: harnessSchema,
  nativeId: z.string().min(1),
})
export const sessionEnsureOutputSchema = z.strictObject({ argoId: z.string().uuid() })

export type SessionList = z.infer<typeof sessionListOutputSchema>
export type SessionListItem = z.infer<typeof sessionListItemSchema>
