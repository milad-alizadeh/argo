import { initTRPC } from '@trpc/server'
import type { Database } from '@/database/database'
import { projectSummarySchema } from '@/database/project/validation'
import { listProjects } from './project-register'

const t = initTRPC.create()

export function projectListProcedure(database: Database) {
  return t.procedure.output(projectSummarySchema.array()).query(() => listProjects(database))
}
