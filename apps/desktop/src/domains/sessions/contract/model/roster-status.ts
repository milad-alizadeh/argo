import { z } from 'zod'

export const ROSTER_STATUSES = ['active', 'archived', 'all'] as const
export const rosterStatusSchema = z.enum(ROSTER_STATUSES)
export type RosterStatus = z.infer<typeof rosterStatusSchema>
