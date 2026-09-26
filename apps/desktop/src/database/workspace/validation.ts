import path from 'node:path'
import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { workspace } from './schema'

export const workspaceSelectSchema = createSelectSchema(workspace)
  .extend({
    id: identifierSchema,
    projectId: identifierSchema,
    displayName: z.string().min(1),
    path: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
  })
  .strict()

export const workspaceRecordSchema = workspaceSelectSchema.omit({
  createdAt: true,
  updatedAt: true,
})

export type WorkspaceRecord = z.infer<typeof workspaceRecordSchema>
