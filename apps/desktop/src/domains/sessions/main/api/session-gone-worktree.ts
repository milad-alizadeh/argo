// A Session whose worktree folder is gone continues in the Project's main checkout and drops the
// worktree. https://code.claude.com/docs/en/worktrees
import { and, eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionWorktreeColumns } from '@/database/session/validation'
import { folderPresent, mainCheckout } from '../worktree'
import type { SessionListChanges } from './session-list-changes'

export type GoneWorktreeContext = { database: Database; changes: SessionListChanges }

// `kept`: no worktree, or its folder is there. `stranded`: gone, with no main checkout to move to.
export type GoneWorktree =
  | { type: 'kept' }
  | { type: 'moved'; gone: string; cwd: string }
  | { type: 'stranded'; gone: string }

// Moves a Session off a gone worktree folder; an unknown Session keeps nothing to move.
export async function leaveGoneWorktree(
  context: GoneWorktreeContext,
  sessionId: string,
): Promise<GoneWorktree> {
  const stored = context.database
    .select({ projectId: sessionTable.projectId, worktreePath: sessionTable.worktreePath })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  const gone = stored?.worktreePath ?? null
  if (stored === undefined || gone === null || (await folderPresent(gone))) return { type: 'kept' }
  const main =
    stored.projectId === null ? null : await mainCheckout(context.database, stored.projectId)
  if (main === null) return { type: 'stranded', gone }
  context.database
    .update(sessionTable)
    .set({ cwd: main, ...sessionWorktreeColumns(null) })
    .where(and(eq(sessionTable.argoId, sessionId), eq(sessionTable.worktreePath, gone)))
    .run()
  context.changes.changed([sessionId])
  return { type: 'moved', gone, cwd: main }
}
