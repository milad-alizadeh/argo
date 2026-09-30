import { z } from 'zod'

export const sessionStatusSchema = z.enum([
  'starting',
  'running',
  'permission',
  'asking',
  'idle',
  'stopped',
  'ended',
  'unknown',
])
export type SessionStatus = z.infer<typeof sessionStatusSchema>

// The statuses of a Session with a Turn under way.
export const WORKING_SESSION_STATUSES: readonly SessionStatus[] = [
  'starting',
  'running',
  'permission',
  'asking',
]
