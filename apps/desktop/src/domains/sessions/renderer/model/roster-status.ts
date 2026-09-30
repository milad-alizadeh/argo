import { z } from 'zod'

const ROSTER_STATUSES = ['active', 'archived', 'all'] as const
const rosterStatusSchema = z.enum(ROSTER_STATUSES)
export type RosterStatus = z.infer<typeof rosterStatusSchema>
