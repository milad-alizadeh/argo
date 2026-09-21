import { z } from 'zod'

export const projectSetupScreenSchema = z.enum([
  'choosing-method',
  'manual',
  'preflight',
  'planning-unavailable',
  'planning',
  'questions',
  'reviewing-plan',
  'invalid-plan',
  'applying',
  'review-required',
  'interrupted',
  'reviewing-diff',
  'cancelling',
  'cancel-failed',
  'awaiting-approval',
  'finalizing',
  'deferred',
  'ready',
])
