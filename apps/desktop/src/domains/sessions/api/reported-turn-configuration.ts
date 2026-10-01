import { z } from 'zod'

// The Model, Effort and Mode as the Harness last reported them; null where it reported none.
export const reportedTurnConfigurationSchema = z.strictObject({
  model: z.string().nullable(),
  effort: z.string().nullable(),
  mode: z.string().nullable(),
})
export type ReportedTurnConfiguration = z.infer<typeof reportedTurnConfigurationSchema>
