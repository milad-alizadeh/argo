import path from 'node:path'
import { initTRPC } from '@trpc/server'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { projectRegistrationSchema, projectSummarySchema } from '@/database/project/validation'

const t = initTRPC.create()

export function projectListProcedure(database: Database) {
  return t.procedure.output(projectSummarySchema.array()).query(() =>
    projectRegistrationSchema
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
      })),
  )
}
