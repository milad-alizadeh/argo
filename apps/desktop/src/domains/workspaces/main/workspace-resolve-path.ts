import { and, eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { workspace } from '@/database/workspace/schema'
import { workspaceRecordSchema } from '@/database/workspace/validation'

export function resolveWorkspacePath(
  database: Database,
  input: { projectId: string; workspaceId: string },
): string | null {
  const stored = database
    .select({
      id: workspace.id,
      projectId: workspace.projectId,
      kind: workspace.kind,
      displayName: workspace.displayName,
      path: workspace.path,
    })
    .from(workspace)
    .where(and(eq(workspace.id, input.workspaceId), eq(workspace.projectId, input.projectId)))
    .get()
  const parsed = workspaceRecordSchema.safeParse(stored)
  return parsed.success ? parsed.data.path : null
}
