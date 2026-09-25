import { opendir } from 'node:fs/promises'
import path from 'node:path'
import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { projectRegistrationSchema, projectSummarySchema } from '@/database/project/validation'
import { isRecord } from '@/shared/validation'

const t = initTRPC.create()

export function projectOpenProcedure(database: Database) {
  return t.procedure
    .input(projectRegistrationSchema.shape.id)
    .output(projectSummarySchema)
    .query(async ({ input }) => {
      const stored = database
        .select({ id: project.id, path: project.path, commonDirectory: project.commonDirectory })
        .from(project)
        .where(eq(project.id, input))
        .get()
      if (stored === undefined)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-project' })
      const parsed = projectRegistrationSchema.safeParse(stored)
      if (!parsed.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'storage-invalid' })
      }
      const failure = await projectAccessFailure(parsed.data.path)
      if (failure !== null) throw new TRPCError({ code: 'BAD_REQUEST', message: failure })
      return {
        id: parsed.data.id,
        name: path.basename(parsed.data.path) || parsed.data.path,
        path: parsed.data.path,
      }
    })
}

async function projectAccessFailure(projectPath: string): Promise<string | null> {
  try {
    const directory = await opendir(projectPath)
    try {
      await directory.read()
    } finally {
      await directory.close()
    }
  } catch (error) {
    if (isRecord(error) && (error.code === 'EACCES' || error.code === 'EPERM')) {
      return 'access-denied'
    }
    if (isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return 'project-unavailable'
    }
    return 'internal-error'
  }
  return null
}
