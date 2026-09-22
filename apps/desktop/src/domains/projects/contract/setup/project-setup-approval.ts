import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

export const projectSetupEffectSchema = z.enum(['planning', 'application'])
export const projectSetupPendingApprovalSchema = z
  .strictObject({
    effect: projectSetupEffectSchema,
    permissionId: identifierSchema,
    description: z.string().min(1),
  })
  .nullable()
