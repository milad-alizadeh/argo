import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { projectSelectSchema } from '@/database/project/validation'
import { workspaceRecordSchema } from '@/database/workspace/validation'
import { reconcileWorkspaces } from '../database/workspace-reconciliation'
import { readWorkspaceFacts } from '../workspace-facts'

const t = initTRPC.create()
const projectRecordSchema = projectSelectSchema.pick({ id: true, path: true })
const inputSchema = z.strictObject({ projectId: projectSelectSchema.shape.id })
const workspaceSummarySchema = workspaceRecordSchema
  .pick({ id: true, kind: true, displayName: true, path: true })
  .extend({
    facts: z.strictObject({
      branch: z.string().min(1).nullable(),
      headSha: z.string().min(1).nullable(),
      dirty: z.boolean(),
    }),
  })
const outputSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('workspace.listed'),
    requestId: z.uuid(),
    workspaces: z.array(workspaceSummarySchema),
  }),
  z.strictObject({
    type: z.literal('workspace.error'),
    requestId: z.uuid(),
    code: z.literal('missing-project'),
  }),
])

export type WorkspaceListContext = {
  database: Database
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}

export function workspaceListProcedure(context: WorkspaceListContext) {
  return t.procedure
    .input(inputSchema)
    .output(outputSchema)
    .query(({ input }) =>
      context.exclusive(() => listWorkspaces({ requestId: randomUUID(), ...input }, context)),
    )
}

async function listWorkspaces(
  input: { requestId: string; projectId: string },
  context: WorkspaceListContext,
): Promise<z.infer<typeof outputSchema>> {
  const registered = projectRecordSchema.safeParse(
    context.database
      .select({ id: project.id, path: project.path })
      .from(project)
      .where(eq(project.id, input.projectId))
      .get(),
  )
  if (!registered.success) {
    return { type: 'workspace.error', requestId: input.requestId, code: 'missing-project' }
  }
  const workspaces = await reconcileWorkspaces(context.database, registered.data)
  return {
    type: 'workspace.listed',
    requestId: input.requestId,
    workspaces: await Promise.all(
      workspaces.map(async (candidate) => ({
        id: candidate.id,
        kind: candidate.kind,
        displayName: candidate.displayName,
        path: candidate.path,
        facts: await readWorkspaceFacts(candidate.path),
      })),
    ),
  }
}
