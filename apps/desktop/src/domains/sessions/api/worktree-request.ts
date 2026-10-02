import { z } from 'zod'

// A git ref name never starts with a dash, so none can be read as an option.
const branchSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith('-') && !value.includes('\0'))

// A new-Session draft's folder: the Project's main checkout, or a new worktree from a local branch.
// A new worktree with no branch begins at the main checkout's current commit.
export const worktreeRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('main') }),
  z.strictObject({ type: z.literal('new'), from: branchSchema.nullable() }),
])

// A Project's default branch when its clone has no `origin/HEAD`, and while its options load.
export const FALLBACK_DEFAULT_BRANCH = 'main'
