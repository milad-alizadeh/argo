import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

// One page of one Project's Sessions, newest first. Each filter narrows the same list.
export const sessionListInputSchema = z.strictObject({
  projectId: z.string().min(1),
  filter: z.enum(['active', 'archived', 'all']).default('active'),
  search: z.string().trim().max(500).default(''),
  ticketKey: identifierSchema.optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(30),
})
