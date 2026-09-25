import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import {
  type ProjectSetupCommandRequest,
  type ProjectSetupReply,
  type ProjectSetupSnapshotRequest,
  projectOpenedSchema,
  projectSetupCommandSchema,
  projectSetupRequiredSchema,
  projectSetupSnapshotSchema,
} from '@/domains/projects/contract/contract'
import { projectCancelledSchema, projectListedSchema } from '@/domains/projects/contract/messages'
import { projectErrorSchema } from '@/domains/projects/contract/project-error'
import { projectWorkspaceListedSchema } from '@/domains/projects/contract/workspace-messages'
import { identifierSchema } from '@/shared/validation'
import { createManagedProjectWorkspace } from './create-managed-project-workspace'
import { listProjectWorkspaces } from './list-project-workspaces'
import { listProjects } from './list-projects'
import { openProject } from './open-project'
import { type ProjectStore, registerProject, relocateProject } from './register-project'
import { selectProject } from './select-project'
import { selectProjectWorkspace } from './select-project-workspace'

const t = initTRPC.create()
const emptyInputSchema = z.undefined()
const projectInputSchema = z.strictObject({ projectId: identifierSchema })
const projectListOutputSchema = z.union([
  projectListedSchema,
  projectCancelledSchema,
  projectErrorSchema,
])
const projectOpenOutputSchema = z.union([
  projectOpenedSchema,
  projectSetupRequiredSchema,
  projectErrorSchema,
])
const workspaceOutputSchema = z.union([projectWorkspaceListedSchema, projectErrorSchema])
const setupOutputSchema = z.union([projectSetupSnapshotSchema, projectErrorSchema])

export type ProjectSetupProcedurePort = {
  snapshot(request: ProjectSetupSnapshotRequest): ProjectSetupReply | Promise<ProjectSetupReply>
  command(request: ProjectSetupCommandRequest): ProjectSetupReply | Promise<ProjectSetupReply>
}

export type ProjectProcedureContext = ProjectStore & {
  projectSetup: ProjectSetupProcedurePort
}

function listRequest() {
  return { version: 1 as const, type: 'project.list' as const, requestId: randomUUID() }
}

function projectRegistryProcedures(context: ProjectProcedureContext) {
  return {
    projectList: t.procedure
      .input(emptyInputSchema)
      .output(projectListOutputSchema)
      .query(() => listProjects(listRequest(), context)),
    projectOpen: t.procedure
      .input(projectInputSchema)
      .output(projectOpenOutputSchema)
      .query(({ input }) =>
        openProject(
          { version: 1, type: 'project.open', requestId: randomUUID(), ...input },
          context,
        ),
      ),
    projectRegister: t.procedure
      .input(emptyInputSchema)
      .output(projectListOutputSchema)
      .mutation(() =>
        registerProject({ version: 1, type: 'project.register', requestId: randomUUID() }, context),
      ),
    projectRelocate: t.procedure
      .input(projectInputSchema)
      .output(projectListOutputSchema)
      .mutation(({ input }) =>
        relocateProject(
          { version: 1, type: 'project.relocate', requestId: randomUUID(), ...input },
          context,
        ),
      ),
    projectSelect: t.procedure
      .input(projectInputSchema)
      .output(projectListOutputSchema)
      .mutation(({ input }) =>
        selectProject(
          { version: 1, type: 'project.select', requestId: randomUUID(), ...input },
          context,
        ),
      ),
  }
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
    ...projectRegistryProcedures(context),
    ...projectWorkspaceProcedures(context),
    ...projectSetupProcedures(context),
  }
}
