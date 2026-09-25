import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { sessionTable } from './session-table'

export const sessionSelectSchema = createSelectSchema(sessionTable)

export const sessionInsertSchema = createInsertSchema(sessionTable).omit({
  argoId: true,
  createdAt: true,
  updatedAt: true,
})

export const sessionUpdateSchema = createUpdateSchema(sessionTable).omit({
  argoId: true,
  createdAt: true,
  updatedAt: true,
})
