import {
  isProjectOpenReply,
  type ProjectOpenReply,
  type ProjectOpenRequest,
  projectError,
  requestIdentifier,
} from './contract'

export type ProjectClient = { openProject(request: ProjectOpenRequest): Promise<ProjectOpenReply> }

export function createProjectClient(invoke: (request: unknown) => Promise<unknown>): ProjectClient {
  return {
    async openProject(request) {
      const requestId = requestIdentifier(request)
      let reply: unknown
      try {
        reply = await invoke(request)
      } catch {
        return projectError('connection-lost', requestId)
      }
      if (
        !isProjectOpenReply(reply) ||
        reply.requestId !== requestId ||
        (reply.type === 'project.opened' && reply.project.id !== request.projectId)
      ) {
        return projectError('invalid-response', requestId)
      }
      return reply
    },
  }
}
