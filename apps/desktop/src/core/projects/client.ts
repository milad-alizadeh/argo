import { requestIdentifier } from '../../boundary'
import {
  isProjectErrorMessage,
  isProjectOpenReply,
  type ProjectError,
  type ProjectOpenReply,
  type ProjectOpenRequest,
  projectError,
} from './contract'
import {
  isProjectCancelled,
  isProjectImported,
  isProjectListed,
  type ProjectImportRequest,
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
  importProjects(request: ProjectImportRequest): Promise<ProjectListReply>
}

function isProjectListReply(value: unknown): value is ProjectListReply {
  return (
    isProjectListed(value) ||
    isProjectImported(value) ||
    isProjectCancelled(value) ||
    isProjectErrorMessage(value)
  )
}

export function createProjectClient(invoke: (request: unknown) => Promise<unknown>): ProjectClient {
  // One send for every action. It is the renderer's whole trust boundary: an unrecognised reply,
  // or one answering another request, becomes `invalid-response` rather than reaching a component.
  async function send<T extends { requestId: string | null }>(
    request: unknown,
    accept: (reply: unknown) => reply is T,
  ): Promise<T | ProjectError> {
    const requestId = requestIdentifier(request)
    let reply: unknown
    try {
      reply = await invoke(request)
    } catch {
      return projectError('connection-lost', requestId)
    }
    if (!accept(reply) || reply.requestId !== requestId) {
      return projectError('invalid-response', requestId)
    }
    return reply
  }

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
    importProjects: (request) => send(request, isProjectListReply),
  }
}
