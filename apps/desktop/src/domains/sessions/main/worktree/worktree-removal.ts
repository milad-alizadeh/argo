// Archiving removes a Session's clean worktree; one with work or unreadable state goes only on
// Remove. A worktree another unarchived Session runs in stays; the main checkout is never read.
import { and, eq, inArray, isNotNull, isNull, notExists, notInArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { type SessionWorktree, sessionWorktreeSchema } from '@/database/session/validation'
import { sessionArchive } from '@/database/session-archive/schema'
import { identifierSchema } from '@/shared/validation'
import { folderPresent, runGit } from './worktree-folder'
import { isClean, readWorktreeWork, type WorktreeWork } from './worktree-work'

// Which worktrees an archive removes: only clean ones, or every one the person chose to.
export const worktreeRemovalSchema = z.enum(['clean', 'all'])
export type WorktreeRemoval = z.infer<typeof worktreeRemovalSchema>
const removalOutcomeSchema = z.enum(['removed', 'missing', 'running', 'kept', 'refused'])
export type RemovalOutcome = z.infer<typeof removalOutcomeSchema>
export const removedWorktreeSchema = sessionWorktreeSchema
  .omit({ base: true })
  .extend({ sessionId: identifierSchema, outcome: removalOutcomeSchema })
export type RemovedWorktree = z.infer<typeof removedWorktreeSchema>

export type RemovalContext = {
  database: Database
  // True while the Session has a Turn under way.
  isRunning: (sessionId: string) => boolean
}

type ArchivedWorktree = Omit<SessionWorktree, 'base'> & { sessionId: string; projectPath: string }

const other = alias(sessionTable, 'other_session')

// The worktrees of these Sessions that no Session outside them still runs in unarchived.
function archivedWorktrees(database: Database, sessionIds: readonly string[]): ArchivedWorktree[] {
  const stillUsed = database
    .select({ id: other.argoId })
    .from(other)
    .leftJoin(sessionArchive, eq(sessionArchive.sessionId, other.argoId))
    .where(
      and(
        eq(other.worktreePath, sessionTable.worktreePath),
        notInArray(other.argoId, [...sessionIds]),
        isNull(sessionArchive.sessionId),
      ),
    )
  return database
    .select({
      sessionId: sessionTable.argoId,
      path: sessionTable.worktreePath,
      branch: sessionTable.worktreeBranch,
      projectPath: project.path,
    })
    .from(sessionTable)
    .innerJoin(project, eq(project.id, sessionTable.projectId))
    .where(
      and(
        inArray(sessionTable.argoId, [...sessionIds]),
        isNotNull(sessionTable.worktreePath),
        notExists(stillUsed),
      ),
    )
    .all()
    .flatMap((row) => (row.path === null ? [] : [{ ...row, path: row.path }]))
}

type HeldWorktree = ArchivedWorktree & { work: WorktreeWork }

// The worktrees of these Sessions that hold work, or whose state git could not read.
export async function worktreesWithWork(
  database: Database,
  sessionIds: readonly string[],
): Promise<HeldWorktree[]> {
  const found = await Promise.all(
    archivedWorktrees(database, sessionIds).map(async (worktree): Promise<HeldWorktree[]> => {
      if (!(await folderPresent(worktree.path))) return []
      const work = await readWorktreeWork(worktree.path, worktree.branch)
      return isClean(work) ? [] : [{ ...worktree, work }]
    }),
  )
  return found.flat()
}

async function removeOne(
  context: RemovalContext,
  worktree: ArchivedWorktree,
  removal: WorktreeRemoval,
): Promise<RemovalOutcome> {
  if (context.isRunning(worktree.sessionId)) return 'running'
  if (!(await folderPresent(worktree.path))) return 'missing'
  const clean = isClean(await readWorktreeWork(worktree.path, worktree.branch))
  if (!clean && removal === 'clean') return 'kept'
  const git = ['-C', worktree.projectPath]
  // A clean tree goes without `--force`, so git itself refuses one that changed since it was read.
  const force = clean ? [] : ['--force']
  const removed = await runGit([...git, 'worktree', 'remove', ...force, worktree.path]).then(
    () => true,
    () => false,
  )
  if (!removed) return 'refused'
  // `-D`, because a squash-merged branch never reads as merged; the checks above made it safe.
  if (worktree.branch !== null)
    await runGit([...git, 'branch', '-D', worktree.branch]).catch(() => undefined)
  return 'removed'
}

// Only a Session still archived lets its worktree go, so a restore that won the race keeps it.
function stillArchived(database: Database, sessionIds: readonly string[]): string[] {
  return database
    .select({ sessionId: sessionArchive.sessionId })
    .from(sessionArchive)
    .where(inArray(sessionArchive.sessionId, [...sessionIds]))
    .all()
    .map(({ sessionId }) => sessionId)
}

// The Session keeps its worktree record; a resume finds the folder gone and moves to the main checkout.
export async function removeSessionWorktrees(
  context: RemovalContext,
  input: { sessionIds: readonly string[]; removal: WorktreeRemoval },
): Promise<RemovedWorktree[]> {
  const archived = stillArchived(context.database, input.sessionIds)
  if (archived.length === 0) return []
  const outcomes: RemovedWorktree[] = []
  for (const worktree of archivedWorktrees(context.database, archived)) {
    const outcome = await removeOne(context, worktree, input.removal)
    outcomes.push({
      sessionId: worktree.sessionId,
      path: worktree.path,
      branch: worktree.branch,
      outcome,
    })
  }
  return outcomes
}
