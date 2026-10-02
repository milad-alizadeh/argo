import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { sessionWorktreeSchema } from '@/database/session/validation'
import { identifierSchema } from '@/shared/validation'
import {
  type RemovedWorktree,
  removedWorktreeSchema,
  type WorktreeOptionsContext,
  type WorktreeRemoval,
  worktreeOptionsProcedure,
  worktreeRemovalSchema,
  worktreeSwitchProcedure,
  worktreesWithWork,
} from '../worktree'
import { type GoneWorktreeContext, leaveGoneWorktree } from './session-gone-worktree'

const t = initTRPC.create()

const heldWorktreeSchema = sessionWorktreeSchema.omit({ base: true }).extend({
  sessionId: identifierSchema,
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

export type SessionWorktreeContext = WorktreeOptionsContext &
  GoneWorktreeContext & {
    // Removes the worktrees of archived Sessions; one whose Session is not archived stays.
    removeSessionWorktrees: (input: {
      sessionIds: string[]
      removal: WorktreeRemoval
    }) => Promise<RemovedWorktree[]>
  }

// Runs once an archive's Undo has closed, and returns each worktree's outcome.
function sessionWorktreeRemoveProcedure(context: SessionWorktreeContext) {
  return t.procedure
    .input(
      z.strictObject({
        sessionIds: z.array(identifierSchema).min(1),
        removal: worktreeRemovalSchema,
      }),
    )
    .output(z.strictObject({ worktrees: z.array(removedWorktreeSchema) }))
    .mutation(async ({ input }) => ({ worktrees: await context.removeSessionWorktrees(input) }))
}

// Opening a Session moves it off a gone worktree folder, and names the folder it left.
function sessionLeaveGoneWorktreeProcedure(context: GoneWorktreeContext) {
  return t.procedure
    .input(z.strictObject({ sessionId: identifierSchema }))
    .output(z.strictObject({ worktreeGone: z.string().min(1).nullable() }))
    .mutation(async ({ input }) => {
      const left = await leaveGoneWorktree(context, input.sessionId)
      switch (left.type) {
        case 'moved':
          return { worktreeGone: left.gone }
        // A Send refuses a stranded Session with its own reason.
        case 'kept':
        case 'stranded':
          return { worktreeGone: null }
      }
    })
}

export function sessionWorktreeProcedures(context: SessionWorktreeContext) {
  return {
    worktreeOptions: worktreeOptionsProcedure(context),
    worktreeSwitch: worktreeSwitchProcedure(context),
    sessionWorktreeWork: sessionWorktreeWorkProcedure(context),
    sessionWorktreeRemove: sessionWorktreeRemoveProcedure(context),
    sessionLeaveGoneWorktree: sessionLeaveGoneWorktreeProcedure(context),
  }
}
