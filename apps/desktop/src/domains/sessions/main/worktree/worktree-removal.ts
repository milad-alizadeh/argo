// Archiving a Session removes its worktree, as Claude Code does on exit: a clean one goes at once,
// and one that holds work, or whose state git could not read, goes only when the person chose
// Remove. A worktree another unarchived Session runs in stays; the main checkout is never read.
import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import { and, eq, inArray, isNotNull, isNull, notExists, notInArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import type { SessionWorktree } from '@/database/session/validation'
import { sessionArchive } from '@/database/session-archive/schema'
import { isClean, readWorktreeWork, type WorktreeWork } from './worktree-work'

const run = promisify(execFile)

export type WorktreeRemoval = 'clean' | 'all'
export type RemovalOutcome = 'removed' | 'missing' | 'running' | 'kept' | 'refused'

export type RemovalContext = {
  database: Database
  // True while the Session has a Turn under way.
  isRunning: (sessionId: string) => boolean
}

type ArchivedWorktree = SessionWorktree & { sessionId: string; projectPath: string }

function present(folder: string): Promise<boolean> {
  return stat(folder).then(
    (found) => found.isDirectory(),
    () => false,
  )
}

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
      if (!(await present(worktree.path))) return []
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
  if (!(await present(worktree.path))) return 'missing'
  const clean = isClean(await readWorktreeWork(worktree.path, worktree.branch))
  if (!clean && removal === 'clean') return 'kept'
  const git = ['-C', worktree.projectPath]
  // A clean tree goes without `--force`, so git itself refuses one that changed since it was read.
  const force = clean ? [] : ['--force']
  const removed = await run('git', [...git, 'worktree', 'remove', ...force, worktree.path]).then(
    () => true,
    () => false,
  )
  if (!removed) return 'refused'
  // `-D`, because a squash-merged branch never reads as merged; the checks above made it safe.
  if (worktree.branch !== null)
    await run('git', [...git, 'branch', '-D', worktree.branch]).catch(() => undefined)
  return 'removed'
}

// The Session keeps its worktree record; a resume finds the folder gone and moves to the main checkout.
export async function removeSessionWorktrees(
  context: RemovalContext,
  input: { sessionIds: readonly string[]; removal: WorktreeRemoval },
): Promise<{ sessionId: string; outcome: RemovalOutcome }[]> {
  const outcomes: { sessionId: string; outcome: RemovalOutcome }[] = []
  for (const worktree of archivedWorktrees(context.database, input.sessionIds))
    outcomes.push({
      sessionId: worktree.sessionId,
      outcome: await removeOne(context, worktree, input.removal),
    })
  return outcomes
}
