import type { sessionTable } from './schema'

export type SessionRow = typeof sessionTable.$inferSelect
export type NewSession = typeof sessionTable.$inferInsert
