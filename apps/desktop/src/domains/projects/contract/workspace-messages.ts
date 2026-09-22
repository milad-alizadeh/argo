// The places a Session can work in a Project: the main checkout, every discovered git worktree,
// and the ones Argo created itself. `facts` is read live from git on every list, never stored, so
// listing a Workspace twice can answer with two different branches for the same id.
import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

export const workspaceKindSchema = z.enum(['main', 'imported', 'managed'])
export type WorkspaceKindContract = z.infer<typeof workspaceKindSchema>

export const workspaceFactsSchema = z.strictObject({
  branch: z.string().min(1).nullable(),
  headSha: z.string().min(1).nullable(),
  dirty: z.boolean(),
})
export type WorkspaceFactsContract = z.infer<typeof workspaceFactsSchema>

export const workspaceSummarySchema = z.strictObject({
  id: identifierSchema,
  kind: workspaceKindSchema,
  displayName: z.string().min(1),
  path: z.string().min(1),
  facts: workspaceFactsSchema,
})
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>

export const projectWorkspaceListRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.workspace.list'),
  requestId: identifierSchema,
  projectId: identifierSchema,
})
export type ProjectWorkspaceListRequest = z.infer<typeof projectWorkspaceListRequestSchema>

export const projectWorkspaceSelectRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.workspace.select'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  workspaceId: identifierSchema,
})
export type ProjectWorkspaceSelectRequest = z.infer<typeof projectWorkspaceSelectRequestSchema>

export const projectWorkspaceCreateManagedRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('project.workspace.createManaged'),
  requestId: identifierSchema,
  projectId: identifierSchema,
  baseRef: identifierSchema,
})
export type ProjectWorkspaceCreateManagedRequest = z.infer<
  typeof projectWorkspaceCreateManagedRequestSchema
>

// Every action that can change the known set answers with the whole set, matching `project.listed`.
export const projectWorkspaceListedSchema = z
  .strictObject({
    version: z.literal(1),
    type: z.literal('project.workspace.listed'),
    requestId: identifierSchema,
    workspaces: z.array(workspaceSummarySchema),
    selectedId: identifierSchema.nullable(),
  })
  .refine(
    ({ workspaces, selectedId }) =>
      selectedId === null || workspaces.some((workspace) => workspace.id === selectedId),
  )
export type ProjectWorkspaceListed = z.infer<typeof projectWorkspaceListedSchema>
