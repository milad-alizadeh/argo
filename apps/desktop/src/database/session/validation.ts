import { createInsertSchema } from 'drizzle-orm/zod'
import { sessionTable } from './schema'

const serverOwnedSessionFields = {
  argoId: true,
  createdAt: true,
  updatedAt: true,
  subagentsReadAt: true,
  listOrderAt: true,
  activity: true,
} as const
export const sessionInsertSchema = createInsertSchema(sessionTable).omit(serverOwnedSessionFields)
