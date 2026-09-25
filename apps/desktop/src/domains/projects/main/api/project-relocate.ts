import path from 'node:path'
import { initTRPC, TRPCError } from '@trpc/server'
import { and, eq, ne } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { projectRegistrationSchema, projectSummarySchema } from '@/database/project/validation'
import { repositoryRoot } from '@/platform/main/git-repository-root'

const t = initTRPC.create()

export type ProjectRelocateContext = {
  database: Database
  chooseFolder: () => Promise<string | null>
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}

export function projectRelocateProcedure(context: ProjectRelocateContext) {
  return t.procedure
    .input(projectRegistrationSchema.shape.id)
    .output(projectSummarySchema)
    .mutation(({ input }) => context.exclusive(() => relocateProject(context, input)))
}

async function relocateProject(context: ProjectRelocateContext, projectId: string) {
  const current = readProject(context.database, projectId)
  const folder = await context.chooseFolder()
  if (folder === null) return current
  const repository = await repositoryRoot(folder)
  if ('failure' in repository) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: repository.failure })
  }
  rejectTakenRepository(context.database, projectId, repository.commonDirectory)
  const updated = context.database
    .update(project)
    .set({ path: repository.root, commonDirectory: repository.commonDirectory })
    .where(eq(project.id, projectId))
    .run()
  if (updated.changes === 0) missingProject()
  return {
    id: projectId,
    name: path.basename(repository.root) || repository.root,
    path: repository.root,
  }
}

function readProject(database: Database, projectId: string) {
  const stored = database
    .select({ id: project.id, path: project.path })
    .from(project)
    .where(eq(project.id, projectId))
    .get()
  if (stored === undefined) return missingProject()
  return { ...stored, name: path.basename(stored.path) || stored.path }
}

function rejectTakenRepository(database: Database, projectId: string, commonDirectory: string) {
  const taken = database
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.commonDirectory, commonDirectory), ne(project.id, projectId)))
    .get()
  if (taken !== undefined) {
    throw new TRPCError({ code: 'CONFLICT', message: 'already-registered' })
  }
}

function missingProject(): never {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-project' })
}
