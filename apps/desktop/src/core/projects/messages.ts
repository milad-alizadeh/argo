// The three actions #1828 adds to the version 1 Project contract, beside the `project.open` that
// #1825 settled. Version 1 gains actions and never changes a message it already defines, so a
// `project.open` exchange is byte-identical to the one the accepted proof asserts.
import { z } from 'zod'
import { guard, identifier, message } from '../contract/messages'
import { type ProjectError, projectErrorSchema } from './contract'

// A Project as the cockpit draws it: the stable ID, the folder name, and the path, which is a
// mutable attribute of the identity rather than the identity itself (CONTEXT.md · Project).
const projectSummary = z.strictObject({
  id: identifier,
  name: z.string().min(1),
  path: z.string().min(1),
})

const listRequest = message('project.list', {})
const registerRequest = message('project.register', {})
const relocateRequest = message('project.relocate', { projectId: identifier })

// Every action that can change the known set answers with the whole set, so the renderer never
// assembles its own picture of storage out of a sequence of replies. A selection that names no
// listed Project is malformed: storage already dropped that on the way out (./registry.ts).
const listed = message('project.listed', {
  projects: z.array(projectSummary),
  selectedId: identifier.nullable(),
}).refine(
  (reply) =>
    reply.selectedId === null || reply.projects.some((project) => project.id === reply.selectedId),
)

// The person dismissed the folder chooser. Nothing was read and nothing was written.
const cancelled = message('project.cancelled', {})

export type ProjectSummary = z.infer<typeof projectSummary>
export type ProjectListRequest = z.infer<typeof listRequest>
export type ProjectRegisterRequest = z.infer<typeof registerRequest>
export type ProjectRelocateRequest = z.infer<typeof relocateRequest>
export type ProjectListed = z.infer<typeof listed>
export type ProjectCancelled = z.infer<typeof cancelled>
export type ProjectListReply = ProjectListed | ProjectCancelled | ProjectError

export const isProjectListRequest = guard(listRequest)
export const isProjectRegisterRequest = guard(registerRequest)
export const isProjectRelocateRequest = guard(relocateRequest)
export const isProjectListReply = guard(z.union([listed, cancelled, projectErrorSchema]))
