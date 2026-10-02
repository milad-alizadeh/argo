import { z } from 'zod'

// A git ref name never starts with a dash, so none can be read as an option.
const branchSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith('-') && !value.includes('\0'))

// Where a new worktree starts: a local branch, or an open pull request's head commit.
const worktreeStartSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('branch'), branch: branchSchema }),
  z.strictObject({ type: z.literal('pull-request'), number: z.number().int().positive() }),
])
export type WorktreeStart = z.infer<typeof worktreeStartSchema>

// A new-Session draft's folder: the Project's main checkout, or a new worktree. A new worktree with
// no start begins at the main checkout's current commit.
export const worktreeRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('main') }),
  z.strictObject({ type: z.literal('new'), from: worktreeStartSchema.nullable() }),
])

// Why the "From" list shows branches only.
export const pullRequestsUnavailableSchema = z.enum([
  'no-remote',
  'no-account',
  'not-visible',
  'unreachable',
])
