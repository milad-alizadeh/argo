import { z } from 'zod'

// Why main refused a Send that never reached the Harness; each reason has a composer catalog entry.
export const sessionSubmitRejectionSchema = z.enum([
  'folder-missing',
  'worktree-create-failed',
  'harness-start-failed',
])
export type SessionSubmitRejection = z.infer<typeof sessionSubmitRejectionSchema>
