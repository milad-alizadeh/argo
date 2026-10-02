import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
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

export const sessionSelectSchema = createSelectSchema(sessionTable, {
  worktreePath: (schema) => schema.min(1),
  worktreeBranch: (schema) => schema.min(1),
})

// The linked worktree a Session runs in, read from its two worktree columns.
export const sessionWorktreeSchema = z.strictObject({
  path: sessionSelectSchema.shape.worktreePath.unwrap(),
  branch: sessionSelectSchema.shape.worktreeBranch,
})
export type SessionWorktree = z.infer<typeof sessionWorktreeSchema>
