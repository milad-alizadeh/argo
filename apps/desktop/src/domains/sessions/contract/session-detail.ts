import { z } from 'zod'
import { harnessSchema } from '@/domains/sessions/next/contract/session-contract'

export const sessionDetailInputSchema = z.strictObject({ argoId: z.uuid() })
export const sessionDetailOutputSchema = z
  .strictObject({
    argoId: z.uuid(),
    harness: harnessSchema,
    title: z.string().nullable(),
    firstPrompt: z.string().nullable(),
    posture: z.enum(['managed', 'watched']),
  })
  .nullable()
