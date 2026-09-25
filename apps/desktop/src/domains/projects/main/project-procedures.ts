import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import {
  type ProjectSetupCommandRequest,
  type ProjectSetupReply,
  type ProjectSetupSnapshotRequest,
  projectSetupCommandSchema,
  projectSetupSnapshotSchema,
} from '@/domains/projects/contract/contract'
import { projectErrorSchema } from '@/domains/projects/contract/project-error'
import { projectWorkspaceListedSchema } from '@/domains/projects/contract/workspace-messages'
import { identifierSchema } from '@/shared/validation'
import { createManagedProjectWorkspace } from './create-managed-project-workspace'
import { listProjectWorkspaces } from './list-project-workspaces'
import type { ProjectStore } from './register-project'
import { selectProjectWorkspace } from './select-project-workspace'

const t = initTRPC.create()
const projectInputSchema = z.strictObject({ projectId: identifierSchema })
const workspaceOutputSchema = z.union([projectWorkspaceListedSchema, projectErrorSchema])
const setupOutputSchema = z.union([projectSetupSnapshotSchema, projectErrorSchema])

export type ProjectSetupProcedurePort = {
  snapshot(request: ProjectSetupSnapshotRequest): ProjectSetupReply | Promise<ProjectSetupReply>
  command(request: ProjectSetupCommandRequest): ProjectSetupReply | Promise<ProjectSetupReply>
}

export type ProjectProcedureContext = ProjectStore & {
  projectSetup: ProjectSetupProcedurePort
}

function projectWorkspaceProcedures(context: ProjectProcedureContext) {
  return {
    projectWorkspaceList: t.procedure
      .input(projectInputSchema)
      .output(workspaceOutputSchema)
      .query(({ input }) =>
        context.exclusive(() =>
          listProjectWorkspaces(
            { version: 1, type: 'project.workspace.list', requestId: randomUUID(), ...input },
            context,
          ),
        ),
      ),
    projectWorkspaceSelect: t.procedure
      .input(z.strictObject({ projectId: identifierSchema, workspaceId: identifierSchema }))
      .output(workspaceOutputSchema)
      .mutation(({ input }) =>
        context.exclusive(() =>
          selectProjectWorkspace(
            { version: 1, type: 'project.workspace.select', requestId: randomUUID(), ...input },
            context,
          ),
        ),
      ),
    projectWorkspaceCreateManaged: t.procedure
      .input(z.strictObject({ projectId: identifierSchema, baseRef: identifierSchema }))
      .output(workspaceOutputSchema)
      .mutation(({ input }) =>
        context.exclusive(() =>
          createManagedProjectWorkspace(
            {
              version: 1,
              type: 'project.workspace.createManaged',
              requestId: randomUUID(),
              ...input,
            },
            context,
          ),
        ),
      ),
  }
}

function projectSetupProcedures(context: ProjectProcedureContext) {
  return {
    projectSetupSnapshot: t.procedure
      .input(projectInputSchema)
      .output(setupOutputSchema)
      .query(({ input }) =>
        context.projectSetup.snapshot({
          version: 1,
          type: 'project.setup.snapshot',
          requestId: randomUUID(),
          ...input,
        }),
      ),
    projectSetupCommand: t.procedure
      .input(
        z.strictObject({
          projectId: identifierSchema,
          commandId: identifierSchema,
          expectedRevision: z.number().int().nonnegative(),
          command: projectSetupCommandSchema,
        }),
      )
      .output(setupOutputSchema)
      .mutation(({ input }) =>
        context.projectSetup.command({
          version: 1,
          type: 'project.setup.command',
          requestId: randomUUID(),
          ...input,
        }),
      ),
  }
}

export function projectProcedures(context: ProjectProcedureContext) {
  return {
    ...projectWorkspaceProcedures(context),
    ...projectSetupProcedures(context),
  }
}
