// Streamed step status during planning and application (#2381 canonical contract). Separate
// schemas because the two phases stream over separate IPC channels, even though the shape matches.

import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

export const setupStepStatusSchema = z.enum([
  'pending',
  'running',
  'waiting-for-user',
  'passed',
  'failed',
])
export type SetupStepStatus = z.infer<typeof setupStepStatusSchema>

const progressEventShape = {
  revision: z.string().min(1),
  stepId: identifierSchema,
  status: setupStepStatusSchema,
  message: z.string().min(1),
}

export const setupPlanningProgressEventSchema = z.object(progressEventShape)
export type SetupPlanningProgressEvent = z.infer<typeof setupPlanningProgressEventSchema>

export const setupApplicationProgressEventSchema = z.object(progressEventShape)
export type SetupApplicationProgressEvent = z.infer<typeof setupApplicationProgressEventSchema>

export function parseSetupPlanningProgressEvent(value: unknown): SetupPlanningProgressEvent {
  return setupPlanningProgressEventSchema.parse(value)
}

export function parseSetupApplicationProgressEvent(value: unknown): SetupApplicationProgressEvent {
  return setupApplicationProgressEventSchema.parse(value)
}
