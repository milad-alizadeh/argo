import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { reportedTurnConfigurationSchema } from '@/domains/sessions/api/reported-turn-configuration'
import { sessionTable } from './schema'

const serverOwnedSessionFields = {
  argoId: true,
  createdAt: true,
  updatedAt: true,
  sortOrder: true,
  status: true,
  activity: true,
  planProgress: true,
} as const
export const sessionInsertSchema = createInsertSchema(sessionTable, {
  turnConfiguration: reportedTurnConfigurationSchema.nullable().optional(),
}).omit(serverOwnedSessionFields)

export const sessionSelectSchema = createSelectSchema(sessionTable)
