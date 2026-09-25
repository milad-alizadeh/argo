import { randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { projectErrorSchema } from '@/domains/projects/contract/contract'
import { projectSummarySchema } from '@/domains/projects/contract/messages'
import type { ProjectStore } from '../register-project'
import { registerProject } from '../register-project'

const t = initTRPC.create()

export function projectRegisterProcedure(projects: ProjectStore) {
  return t.procedure.output(projectSummarySchema.array()).mutation(async () => {
    const reply = await registerProject(
      { version: 1, type: 'project.register', requestId: randomUUID() },
      projects,
    )
    if (reply.type !== 'project.listed') {
      const parsed = projectErrorSchema.safeParse(reply)
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: parsed.success ? parsed.data.code : 'Project registration failed.',
      })
    }
    return projectSummarySchema.array().parse(reply.projects)
  })
}
