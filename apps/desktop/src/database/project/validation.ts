import path from 'node:path'
import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { project } from './schema'

export const projectSelectSchema = createSelectSchema(project)
  .pick({ id: true, path: true, commonDirectory: true })
  .extend({
    id: identifierSchema,
    path: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
    commonDirectory: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
  })
  .strict()

export const projectRegistrationSchema = projectSelectSchema

export type ProjectRegistration = z.infer<typeof projectRegistrationSchema>

export const projectSummarySchema = projectSelectSchema
  .pick({ id: true, path: true })
  .extend({ name: z.string().min(1) })

export type ProjectSummary = z.infer<typeof projectSummarySchema>
