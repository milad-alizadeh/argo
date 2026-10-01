// Archiving a Session removes the worktree Argo made for it, as Claude Code does on exit: a clean
// one goes at once, and one that holds work, or whose state git could not read, goes only when the
// person chose Remove. The main checkout and imported worktrees are never read.
import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { isClean, readWorktreeWork, type WorktreeWork } from './worktree-work'

const run = promisify(execFile)

export type WorktreeRemoval = 'clean' | 'all'
export type RemovalOutcome = 'removed' | 'missing' | 'running' | 'kept' | 'refused'

export type RemovalContext = {
  database: Database
  // True while the Session has a Turn under way.
  isRunning: (sessionId: string) => boolean
}

type OwnedWorktree = { sessionId: string; path: string; branch: string | null; projectPath: string }

function present(folder: string): Promise<boolean> {
  return stat(folder).then(
    (found) => found.isDirectory(),
    () => false,
  )
}

function ownedWorktrees(database: Database, sessionIds: readonly string[]): OwnedWorktree[] {
  return database
    .select({
      sessionId: sessionTable.argoId,
      path: sessionTable.worktreePath,
      branch: sessionTable.worktreeBranch,
      projectPath: project.path,
    })
    .from(sessionTable)
    .innerJoin(project, eq(project.id, sessionTable.projectId))
    .where(and(inArray(sessionTable.argoId, [...sessionIds]), eq(sessionTable.worktreeOwned, true)))
    .all()
    .flatMap((row) => (row.path === null ? [] : [{ ...row, path: row.path }]))
}

type HeldWorktree = OwnedWorktree & { work: WorktreeWork }

// The owned worktrees of these Sessions that hold work, or whose state git could not read.
export async function worktreesWithWork(
  database: Database,
  sessionIds: readonly string[],
): Promise<HeldWorktree[]> {
  const found = await Promise.all(
    ownedWorktrees(database, sessionIds).map(async (worktree): Promise<HeldWorktree[]> => {
      if (!(await present(worktree.path))) return []
      const work = await readWorktreeWork(worktree.path, worktree.branch)
      return isClean(work) ? [] : [{ ...worktree, work }]
    }),
  )
  return found.flat()
}

async function removeOne(
  context: RemovalContext,
  worktree: OwnedWorktree,
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
export async function removeOwnedWorktrees(
  context: RemovalContext,
  input: { sessionIds: readonly string[]; removal: WorktreeRemoval },
): Promise<{ sessionId: string; outcome: RemovalOutcome }[]> {
  const outcomes: { sessionId: string; outcome: RemovalOutcome }[] = []
  for (const worktree of ownedWorktrees(context.database, input.sessionIds))
    outcomes.push({
      sessionId: worktree.sessionId,
      outcome: await removeOne(context, worktree, input.removal),
    })
  return outcomes
}
