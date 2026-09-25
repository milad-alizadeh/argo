import { randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { projectErrorSchema } from '@/domains/projects/contract/contract'
import { projectSummarySchema } from '@/domains/projects/contract/messages'
import { listProjects } from '../list-projects'
import { openProject } from '../open-project'
import { type ProjectStore, registerProject, relocateProject } from '../register-project'

const t = initTRPC.create()
function requestId() {
  return randomUUID()
}

function raiseProjectError(reply: unknown): never {
  const parsed = projectErrorSchema.safeParse(reply)
  if (!parsed.success) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
  throw new TRPCError({ code: 'BAD_REQUEST', message: parsed.data.code })
}

const projectSummaryIdSchema = z.string().min(1)

function unavailableProjectProcedures() {
  return {
    projectList: t.procedure.output(projectSummarySchema.array()).query(() => []),
    projectOpen: t.procedure
      .input(projectSummaryIdSchema)
      .output(projectSummarySchema)
      .query(() => {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Project procedures are unavailable.',
        })
      }),
    projectRegister: t.procedure.output(projectSummarySchema.array()).mutation(() => []),
    projectRelocate: t.procedure
      .input(projectSummaryIdSchema)
      .output(projectSummarySchema.array())
      .mutation(() => []),
  }
}

export function projectProcedures(projects: ProjectStore | null) {
  if (projects === null) return unavailableProjectProcedures()
  return {
    projectList: t.procedure.query(async () => {
      const reply = await listProjects(
        { version: 1, type: 'project.list', requestId: requestId() },
        projects,
      )
      if (reply.type !== 'project.listed') raiseProjectError(reply)
      return projectSummarySchema.array().parse(reply.projects)
    }),
    projectOpen: t.procedure.input(z.string().min(1)).query(async ({ input }) => {
      const reply = await openProject(
        { version: 1, type: 'project.open', requestId: requestId(), projectId: input },
        projects,
      )
      if (reply.type !== 'project.opened') raiseProjectError(reply)
      return reply.project
    }),
    projectRegister: t.procedure.mutation(async () => {
      const reply = await registerProject(
        { version: 1, type: 'project.register', requestId: requestId() },
        projects,
      )
      if (reply.type !== 'project.listed') raiseProjectError(reply)
      return projectSummarySchema.array().parse(reply.projects)
    }),
    projectRelocate: t.procedure.input(z.string().min(1)).mutation(async ({ input }) => {
      const reply = await relocateProject(
        { version: 1, type: 'project.relocate', requestId: requestId(), projectId: input },
        projects,
      )
      if (reply.type !== 'project.listed') raiseProjectError(reply)
      return projectSummarySchema.array().parse(reply.projects)
    }),
  }
}
