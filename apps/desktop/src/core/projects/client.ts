import { requestIdentifier } from '../../boundary'
import { createSender } from '../contract/messages'
import {
  isProjectOpenReply,
  type ProjectError,
  type ProjectOpenReply,
  type ProjectOpenRequest,
  projectError,
} from './contract'
import {
  isProjectListReply,
  type ProjectListReply,
  type ProjectListRequest,
  type ProjectRegisterRequest,
  type ProjectRelocateRequest,
} from './messages'

export type ProjectClient = {
  openProject(request: ProjectOpenRequest): Promise<ProjectOpenReply>
  listProjects(request: ProjectListRequest): Promise<ProjectListReply>
  registerProject(request: ProjectRegisterRequest): Promise<ProjectListReply>
  relocateProject(request: ProjectRelocateRequest): Promise<ProjectListReply>
}

export function createProjectClient(invoke: (request: unknown) => Promise<unknown>): ProjectClient {
  const send = createSender<ProjectError>(invoke, projectError)

  return {
    async openProject(request) {
      const reply = await send(request, isProjectOpenReply)
      // The identity is what was asked for, not merely a well formed one.
      if (reply.type === 'project.opened' && reply.project.id !== request.projectId) {
        return projectError('invalid-response', requestIdentifier(request))
      }
      return reply
    },
    listProjects: (request) => send(request, isProjectListReply),
    registerProject: (request) => send(request, isProjectListReply),
    relocateProject: (request) => send(request, isProjectListReply),
  }
}
