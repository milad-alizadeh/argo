import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { sessionTable } from './session-table'

const serverOwnedSessionFields = {
  argoId: true,
  createdAt: true,
  updatedAt: true,
} as const

export const sessionSelectSchema = createSelectSchema(sessionTable)

export const sessionInsertSchema = createInsertSchema(sessionTable).omit(serverOwnedSessionFields)

export const sessionUpdateSchema = createUpdateSchema(sessionTable).omit(serverOwnedSessionFields)
