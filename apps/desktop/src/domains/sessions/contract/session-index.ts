import { z } from 'zod'
import { harnessSchema } from '@/harnesses/harness'

export const discoveredSessionSchema = z.strictObject({
  harness: harnessSchema,
  nativeId: z.string().min(1),
  vendorTitle: z.string().min(1).nullable(),
  firstPrompt: z.string().min(1).nullable(),
  updatedAt: z.number().int().nonnegative(),
  workingDirectory: z.string().min(1).nullable(),
})

export type DiscoveredSession = z.infer<typeof discoveredSessionSchema>

export const sessionPageInputSchema = z.strictObject({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  projectId: z.string().uuid().nullable().default(null),
})

export const sessionPageOutputSchema = z.strictObject({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  indexedTotal: z.number().int().nonnegative(),
  sessions: z.array(
    z.strictObject({
      argoId: z.string().uuid(),
      harness: harnessSchema,
      nativeId: z.string().min(1),
      projectId: z.string().uuid().nullable(),
      vendorTitle: z.string().nullable(),
      firstPrompt: z.string().nullable(),
      updatedAt: z.number().int().nonnegative(),
      workingDirectory: z.string().nullable(),
    }),
  ),
})
