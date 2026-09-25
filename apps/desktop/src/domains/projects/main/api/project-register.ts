import { randomUUID } from 'node:crypto'
import { initTRPC, TRPCError } from '@trpc/server'
import { projectErrorSchema } from '@/domains/projects/contract/contract'
import { projectSummarySchema } from '@/domains/projects/contract/messages'
import type { ProjectStore } from '../register-project'
import { registerProject } from '../register-project'
import { repositoryRoot } from '../repository'

const t = initTRPC.create()

export function projectRegisterProcedure(projects: ProjectStore) {
  return t.procedure.output(projectSummarySchema.array()).mutation(async () => {
    let chosenFolder: string | null = null
    const reply = await registerProject(
      { version: 1, type: 'project.register', requestId: randomUUID() },
      {
        ...projects,
        chooseFolder: async () => {
          chosenFolder = await projects.chooseFolder()
          return chosenFolder
        },
      },
    )
    if (reply.type !== 'project.listed') {
      const parsed = projectErrorSchema.safeParse(reply)
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: parsed.success ? parsed.data.code : 'Project registration failed.',
      })
    }
    const summaries = projectSummarySchema.array().parse(reply.projects)
    if (chosenFolder === null) return summaries
    const chosen = await repositoryRoot(chosenFolder)
    if ('failure' in chosen) return summaries
    const selectedId = projects.projects
      .read()
      .projects.find((project) => project.commonDirectory === chosen.commonDirectory)?.id
    if (!selectedId) return summaries
    const selected = summaries.find((project) => project.id === selectedId)
    return selected
      ? [...summaries.filter((project) => project.id !== selectedId), selected]
      : summaries
  })
}
