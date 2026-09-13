// The three actions #1828 adds to the version 1 Project contract, beside the `project.open` that
// #1825 settled. Version 1 gains actions and never changes a message it already defines, so a
// `project.open` exchange is byte-identical to the one the accepted proof asserts.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import type { ProjectError } from './contract'

// A Project as the cockpit draws it: the stable ID, the folder name, and the path, which is a
// mutable attribute of the identity rather than the identity itself (CONTEXT.md · Project).
export const projectSummarySchema = z.strictObject({
  id: identifierSchema,
  name: z.string().min(1),
  path: z.string().min(1),
})
export type ProjectSummary = z.infer<typeof projectSummarySchema>

export const projectListRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.list'),
  requestId: identifierSchema,
})
export type ProjectListRequest = z.infer<typeof projectListRequestSchema>
export const projectRegisterRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.register'),
  requestId: identifierSchema,
})
export type ProjectRegisterRequest = z.infer<typeof projectRegisterRequestSchema>
export const projectRelocateRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.relocate'),
  requestId: identifierSchema,
  projectId: identifierSchema,
})
export type ProjectRelocateRequest = z.infer<typeof projectRelocateRequestSchema>

// Every action that can change the known set answers with the whole set, so the renderer never
// assembles its own picture of storage out of a sequence of replies.
export const projectListedSchema = z
  .strictObject({
    version: z.literal(1),
    type: z.literal('project.listed'),
    requestId: identifierSchema,
    projects: z.array(projectSummarySchema),
    selectedId: identifierSchema.nullable(),
  })
  .refine(
    ({ projects, selectedId }) =>
      selectedId === null || projects.some(({ id }) => id === selectedId),
  )
export type ProjectListed = z.infer<typeof projectListedSchema>

// The person dismissed the folder chooser. Nothing was read and nothing was written.
export const projectCancelledSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.cancelled'),
  requestId: identifierSchema,
})
export type ProjectCancelled = z.infer<typeof projectCancelledSchema>

export type ProjectListReply = ProjectListed | ProjectCancelled | ProjectError
