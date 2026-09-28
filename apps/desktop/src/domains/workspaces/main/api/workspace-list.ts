import { randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { projectSelectSchema } from '@/database/project/validation'
import { workspace } from '@/database/workspace/schema'
import { workspaceRecordSchema } from '@/database/workspace/validation'
import { identifierSchema } from '@/shared/validation'
import { reconcileWorkspaces } from '../database/workspace-reconciliation'
import { readWorkspaceFacts } from '../workspace-facts'

const t = initTRPC.create()
const inputSchema = z.strictObject({ projectId: projectSelectSchema.shape.id })
const choiceSchema = identifierSchema
const projectRecordSchema = projectSelectSchema
  .pick({ id: true, path: true })
  .extend({ lastWorkspaceChoice: choiceSchema })
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
    choice: choiceSchema,
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

export function workspaceChooseProcedure(context: WorkspaceListContext) {
  return t.procedure
    .input(inputSchema.extend({ choice: choiceSchema }))
    .output(z.strictObject({ choice: choiceSchema }))
    .mutation(({ input }) =>
      context.exclusive(async () => {
        const registered = context.database
          .select({ id: project.id })
          .from(project)
          .where(eq(project.id, input.projectId))
          .get()
        if (registered === undefined)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-project' })
        if (input.choice !== 'new') {
          const selected = context.database
            .select({ id: workspace.id })
            .from(workspace)
            .where(and(eq(workspace.id, input.choice), eq(workspace.projectId, input.projectId)))
            .get()
          if (selected === undefined)
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'missing-workspace' })
        }
        context.database
          .update(project)
          .set({ lastWorkspaceChoice: input.choice })
          .where(eq(project.id, input.projectId))
          .run()
        return { choice: input.choice }
      }),
    )
}

async function listWorkspaces(
  input: { requestId: string; projectId: string },
  context: WorkspaceListContext,
): Promise<z.infer<typeof outputSchema>> {
  const registered = projectRecordSchema.safeParse(
    context.database
      .select({
        id: project.id,
        path: project.path,
        lastWorkspaceChoice: project.lastWorkspaceChoice,
      })
      .from(project)
      .where(eq(project.id, input.projectId))
      .get(),
  )
  if (!registered.success) {
    return { type: 'workspace.error', requestId: input.requestId, code: 'missing-project' }
  }
  const workspaces = await reconcileWorkspaces(context.database, registered.data)
  const choice = registered.data.lastWorkspaceChoice
  const availableChoice =
    choice !== 'new' && !workspaces.some((candidate) => candidate.id === choice) ? 'new' : choice
  return {
    type: 'workspace.listed',
    requestId: input.requestId,
    choice: availableChoice,
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
