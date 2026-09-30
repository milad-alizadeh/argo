import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import type { z } from 'zod'
import { sessionTable } from './schema'

const serverOwnedSessionFields = {
  argoId: true,
  createdAt: true,
  updatedAt: true,
  sortOrder: true,
  status: true,
  activity: true,
} as const
export const sessionInsertSchema = createInsertSchema(sessionTable).omit(serverOwnedSessionFields)

export const sessionStatusSchema = createSelectSchema(sessionTable).shape.status.unwrap()
export type SessionStatus = z.infer<typeof sessionStatusSchema>
