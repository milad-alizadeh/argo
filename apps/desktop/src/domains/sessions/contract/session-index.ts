import { z } from 'zod'
import { harnessSchema } from '@/harnesses/harness'

export const sessionIngestionSchema = z.strictObject({
  harness: harnessSchema,
  nativeId: z.string().min(1),
  vendorTitle: z.string().min(1).nullable(),
  firstPrompt: z.string().min(1).nullable(),
  updatedAt: z.number().int().nonnegative(),
  workingDirectory: z.string().min(1).nullable(),
})

export type SessionIngestion = z.infer<typeof sessionIngestionSchema>
