import { randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { projectErrorSchema, projectOpenedSchema } from '@/domains/projects/contract/contract'
import { openProject } from '../open-project'
import type { ProjectStore } from '../register-project'

const t = initTRPC.create()
const projectIdSchema = z.string().min(1)

export function projectOpenProcedure(projects: ProjectStore) {
  return t.procedure
    .input(projectIdSchema)
    .output(projectOpenedSchema.shape.project)
    .query(async ({ input }) => {
      const reply = await openProject(
        { version: 1, type: 'project.open', requestId: randomUUID(), projectId: input },
        projects,
      )
      if (reply.type !== 'project.opened') {
        const parsed = projectErrorSchema.safeParse(reply)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: parsed.success ? parsed.data.code : 'Project opening failed.',
        })
      }
      return reply.project
    })
}
