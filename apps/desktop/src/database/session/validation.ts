import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { sessionTable } from './schema'

const serverOwnedSessionFields = {
  argoId: true,
  createdAt: true,
  updatedAt: true,
} as const

export const sessionSelectSchema = createSelectSchema(sessionTable)
export const sessionInsertSchema = createInsertSchema(sessionTable).omit(serverOwnedSessionFields)
