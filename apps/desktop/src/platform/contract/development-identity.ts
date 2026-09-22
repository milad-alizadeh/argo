import { z } from 'zod'

export const DEVELOPMENT_IDENTITY_ARGUMENT_PREFIX = '--argo-desktop-development-identity='

export const developmentIdentitySchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  title: z.string().min(1),
  worktree: z.string().min(1),
})

export type DevelopmentIdentity = z.infer<typeof developmentIdentitySchema>
