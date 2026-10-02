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
  worktreeBase: (schema) => schema.min(1),
})

// The linked worktree a Session runs in, read from its worktree columns. `base` is the local branch
// Argo started it from; null from a detached commit or a worktree made outside Argo.
export const sessionWorktreeSchema = z.strictObject({
  path: sessionSelectSchema.shape.worktreePath.unwrap(),
  branch: sessionSelectSchema.shape.worktreeBranch,
  base: sessionSelectSchema.shape.worktreeBase,
})
export type SessionWorktree = z.infer<typeof sessionWorktreeSchema>

type SessionWorktreeColumns = {
  worktreePath: string | null
  worktreeBranch: string | null
  worktreeBase: string | null
}

export function sessionWorktreeFromColumns(row: SessionWorktreeColumns): SessionWorktree | null {
  const { worktreePath: path, worktreeBranch: branch, worktreeBase: base } = row
  return path === null ? null : { path, branch, base }
}

export function sessionWorktreeColumns(worktree: SessionWorktree | null): SessionWorktreeColumns {
  return {
    worktreePath: worktree?.path ?? null,
    worktreeBranch: worktree?.branch ?? null,
    worktreeBase: worktree?.base ?? null,
  }
}
