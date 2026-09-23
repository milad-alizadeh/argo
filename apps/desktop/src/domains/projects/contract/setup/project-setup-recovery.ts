import { z } from 'zod'

export const PROJECT_SETUP_RECOVERY_CODES = [
  'interrupted',
  'application-drift',
  'cancelled',
  'cancel-failed',
  'restart-failed',
  'finalization-failed',
  'restart-interrupted',
  'restart-finalization-unconfirmed',
] as const

export const projectSetupRecoveryCodeSchema = z.enum(PROJECT_SETUP_RECOVERY_CODES)
export type ProjectSetupRecoveryCode = z.infer<typeof projectSetupRecoveryCodeSchema>
