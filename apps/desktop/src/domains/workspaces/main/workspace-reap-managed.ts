// Removes a managed Workspace's worktree and branch once nothing can be lost. Each check is a reason
// to keep, so a fact git could not read keeps the tree; `main` and `imported` are never read.
import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { workspace } from '@/database/workspace/schema'
import { readWorkspaceFacts } from './workspace-facts'

const run = promisify(execFile)

export type ReapOutcome =
  | 'removed'
  | 'missing'
  | 'unread'
  | 'dirty'
  | 'unmerged'
  | 'in-use'
  | 'not-landed'
  | 'refused'

type ManagedCandidate = { id: string; path: string; projectPath: string }
type WorkspaceSession = { id: string; archived: boolean }

export type ReapContext = {
  database: Database
  hasLiveChannel: (sessionId: string) => boolean
}

function succeeds(arguments_: string[], timeout?: number): Promise<boolean> {
  return run('git', arguments_, { timeout }).then(
    () => true,
    () => false,
  )
}

function readOutput(arguments_: string[]): Promise<string | null> {
  return run('git', arguments_).then(
    (result) => result.stdout.trim() || null,
    () => null,
  )
}

function within(folder: string, cwd: string | null): boolean {
  return cwd !== null && (cwd === folder || cwd.startsWith(`${folder}${path.sep}`))
}

function sessionsIn(database: Database, candidate: ManagedCandidate): WorkspaceSession[] {
  return database
    .select({
      id: sessionTable.argoId,
      workspaceId: sessionTable.workspaceId,
      cwd: sessionTable.cwd,
      archivedId: sessionArchive.sessionId,
    })
    .from(sessionTable)
    .leftJoin(sessionArchive, eq(sessionArchive.sessionId, sessionTable.argoId))
    .all()
    .filter((row) => row.workspaceId === candidate.id || within(candidate.path, row.cwd))
    .map((row) => ({ id: row.id, archived: row.archivedId !== null }))
}

// Commits this branch alone holds: on no other local branch and no remote-tracking ref.
async function holdsOwnCommits(folder: string, branch: string): Promise<boolean> {
  const count = await readOutput([
    '-C',
    folder,
    'rev-list',
    '--count',
    'HEAD',
    '--not',
    `--exclude=${branch}`,
    '--branches',
    '--remotes',
  ])
  return count !== '0'
}

// A pushed branch whose head the remote default branch contains, read after a fetch.
async function landedOnRemote(folder: string, branch: string): Promise<boolean> {
  const remote = await readOutput(['-C', folder, 'config', `branch.${branch}.remote`])
  if (remote === null) return false
  if (!(await succeeds(['-C', folder, 'fetch', '--prune', remote], 120_000))) return false
  const defaultBranch = await readOutput([
    '-C',
    folder,
    'symbolic-ref',
    '--short',
    `refs/remotes/${remote}/HEAD`,
  ])
  if (defaultBranch === null) return false
  return succeeds(['-C', folder, 'merge-base', '--is-ancestor', 'HEAD', defaultBranch])
}

async function reapOne(context: ReapContext, candidate: ManagedCandidate): Promise<ReapOutcome> {
  const present = await stat(candidate.path).then(
    (found) => found.isDirectory(),
    () => false,
  )
  if (!present) return 'missing'
  const facts = await readWorkspaceFacts(candidate.path)
  if (facts.branch === null) return 'unread'
  if (facts.dirty) return 'dirty'
  if (await holdsOwnCommits(candidate.path, facts.branch)) return 'unmerged'
  const sessions = sessionsIn(context.database, candidate)
  const inUse = () => sessions.some((session) => context.hasLiveChannel(session.id))
  if (inUse()) return 'in-use'
  const archived = sessions.length > 0 && sessions.every((session) => session.archived)
  if (!archived && !(await landedOnRemote(candidate.path, facts.branch))) return 'not-landed'
  // The fetch above can take a while, and a resume may have opened a channel meanwhile.
  if (inUse()) return 'in-use'
  // No `--force`: git itself refuses a tree that changed since it was read.
  const git = ['-C', candidate.projectPath]
  if (!(await succeeds([...git, 'worktree', 'remove', candidate.path]))) return 'refused'
  // `-D`, because a squash-merged branch never reads as merged; the checks above made it safe.
  await succeeds([...git, 'branch', '-D', facts.branch])
  return 'removed'
}

// The Workspace row stays for the Sessions that name it; reconciliation stops offering it.
export async function reapManagedWorkspaces(
  context: ReapContext,
): Promise<{ workspaceId: string; outcome: ReapOutcome }[]> {
  const candidates = context.database
    .select({ id: workspace.id, path: workspace.path, projectPath: project.path })
    .from(workspace)
    .innerJoin(project, eq(project.id, workspace.projectId))
    .where(eq(workspace.kind, 'managed'))
    .all()
  const outcomes: { workspaceId: string; outcome: ReapOutcome }[] = []
  for (const candidate of candidates)
    outcomes.push({ workspaceId: candidate.id, outcome: await reapOne(context, candidate) })
  return outcomes
}
