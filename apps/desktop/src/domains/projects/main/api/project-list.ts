import { randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { projectErrorSchema } from '@/domains/projects/contract/contract'
import { projectSummarySchema } from '@/domains/projects/contract/messages'
import { listProjects } from '../list-projects'
import type { ProjectStore } from '../register-project'

const t = initTRPC.create()

export function projectListProcedure(projects: ProjectStore) {
  return t.procedure.output(projectSummarySchema.array()).query(async () => {
    const reply = await listProjects(
      { version: 1, type: 'project.list', requestId: randomUUID() },
      projects,
    )
    if (reply.type !== 'project.listed') {
      const parsed = projectErrorSchema.safeParse(reply)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: parsed.success ? parsed.data.code : 'Project listing failed.',
      })
    }
    return projectSummarySchema.array().parse(reply.projects)
  })
}
