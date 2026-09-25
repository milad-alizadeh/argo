import { randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { projectErrorSchema } from '@/domains/projects/contract/contract'
import { projectSummarySchema } from '@/domains/projects/contract/messages'
import type { ProjectStore } from '../register-project'
import { relocateProject } from '../register-project'

const t = initTRPC.create()
const projectIdSchema = z.string().min(1)

export function projectRelocateProcedure(projects: ProjectStore) {
  return t.procedure
    .input(projectIdSchema)
    .output(projectSummarySchema.array())
    .mutation(async ({ input }) => {
      const reply = await relocateProject(
        { version: 1, type: 'project.relocate', requestId: randomUUID(), projectId: input },
        projects,
      )
      if (reply.type !== 'project.listed') {
        const parsed = projectErrorSchema.safeParse(reply)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: parsed.success ? parsed.data.code : 'Project relocation failed.',
        })
      }
      return projectSummarySchema.array().parse(reply.projects)
    })
}
