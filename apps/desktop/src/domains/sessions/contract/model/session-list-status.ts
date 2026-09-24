import { z } from 'zod'

export const SESSION_LIST_STATUSES = ['active', 'archived', 'all'] as const
export const sessionListStatusSchema = z.enum(SESSION_LIST_STATUSES)
export type SessionListStatus = z.infer<typeof sessionListStatusSchema>
