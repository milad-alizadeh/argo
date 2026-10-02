import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import {
  type WorktreeOptionsContext,
  worktreeOptionsProcedure,
  worktreeSwitchProcedure,
  worktreesWithWork,
} from '../worktree'

const t = initTRPC.create()

const heldWorktreeSchema = z.strictObject({
  sessionId: identifierSchema,
  path: z.string().min(1),
  branch: z.string().min(1).nullable(),
  // A count git could not read is null, and the archive dialog names it as unchecked.
  changedFiles: z.number().int().nonnegative().nullable(),
  ownCommits: z.number().int().nonnegative().nullable(),
})

// The Session worktrees an archive would ask about: each holds work, or its state is unknown.
function sessionWorktreeWorkProcedure(context: WorktreeOptionsContext) {
  return t.procedure
    .input(z.strictObject({ sessionIds: z.array(identifierSchema).min(1) }))
    .output(z.strictObject({ worktrees: z.array(heldWorktreeSchema) }))
    .query(async ({ input }) => ({
      worktrees: (await worktreesWithWork(context.database, input.sessionIds)).map(
        ({ sessionId, path, branch, work }) => ({ sessionId, path, branch, ...work }),
      ),
    }))
}

export function sessionWorktreeProcedures(context: WorktreeOptionsContext) {
  return {
    worktreeOptions: worktreeOptionsProcedure(context),
    worktreeSwitch: worktreeSwitchProcedure(context),
    sessionWorktreeWork: sessionWorktreeWorkProcedure(context),
  }
}
