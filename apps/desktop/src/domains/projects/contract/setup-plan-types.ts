import type { z } from 'zod'
import type { acceptedSetupPlanSchema, setupPlanSchema } from './setup-plan-schema'

export type SetupPlan = z.infer<typeof setupPlanSchema>
export type AcceptedSetupPlan = z.infer<typeof acceptedSetupPlanSchema>
