import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { projectRegistrationSchema, projectSummarySchema } from '@/database/project/validation'
import { repositoryRoot } from '@/platform/main/git-repository-root'

const t = initTRPC.create()

export type ProjectRegisterContext = {
  database: Database
  chooseFolder: () => Promise<string | null>
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}

export function projectRegisterProcedure(context: ProjectRegisterContext) {
  return t.procedure.output(projectSummarySchema.array()).mutation(() =>
    context.exclusive(async () => {
      const folder = await context.chooseFolder()
      if (folder === null) return listProjects(context.database)
      const repository = await repositoryRoot(folder)
      if ('failure' in repository) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: repository.failure })
      }
      const existing = context.database
        .select({ id: project.id })
        .from(project)
        .where(eq(project.commonDirectory, repository.commonDirectory))
        .get()
      const selectedId = existing?.id ?? `project-${randomUUID()}`
      if (existing === undefined) {
        context.database
          .insert(project)
          .values({
            id: selectedId,
            path: repository.root,
            commonDirectory: repository.commonDirectory,
          })
          .run()
      }
      const projects = listProjects(context.database)
      const selected = projects.find((candidate) => candidate.id === selectedId)
      return selected === undefined
        ? projects
        : [...projects.filter((candidate) => candidate.id !== selectedId), selected]
    }),
  )
}

function listProjects(database: Database) {
  return projectRegistrationSchema
    .array()
    .parse(
      database
        .select({ id: project.id, path: project.path, commonDirectory: project.commonDirectory })
        .from(project)
        .all(),
    )
    .map((registration) => ({
      id: registration.id,
      name: path.basename(registration.path) || registration.path,
      path: registration.path,
    }))
}
