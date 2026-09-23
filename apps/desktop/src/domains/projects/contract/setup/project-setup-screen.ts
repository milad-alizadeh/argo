import { z } from 'zod'

export const projectSetupScreenSchema = z.enum([
  'choosing-method',
  'manual',
  'planning',
  'restarting',
  'restart-failed',
  'questions',
  'reviewing-plan',
  'customizing-project-setup',
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
