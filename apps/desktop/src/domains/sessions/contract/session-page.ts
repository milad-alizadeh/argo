import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { harnessSchema } from '../next/contract/session-contract'

export const sessionPageInputSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(100),
})

export const sessionPageItemSchema = z.strictObject({
  argoId: identifierSchema,
  harness: harnessSchema,
  nativeId: identifierSchema,
  title: z.string().nullable(),
})

export const sessionPageOutputSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  items: z.array(sessionPageItemSchema),
})

export type SessionPageOutput = z.infer<typeof sessionPageOutputSchema>
