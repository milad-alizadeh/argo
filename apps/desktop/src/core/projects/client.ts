import { createDomainClient } from '../contract/domain'
import { type ProjectOpenReply, projectError } from './contract'
import type { ProjectListReply } from './messages'
import { PROJECT_OPERATIONS } from './operations'

export type ProjectClient = {
  openProject(request: { projectId: string }): Promise<ProjectOpenReply>
  listProjects(): Promise<ProjectListReply>
  registerProject(): Promise<ProjectListReply>
  relocateProject(request: { projectId: string }): Promise<ProjectListReply>
  selectProject(request: { projectId: string }): Promise<ProjectListReply>
}

export function createProjectClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): ProjectClient {
  const client = createDomainClient(PROJECT_OPERATIONS, invoke, projectError)
  return {
    async openProject(request) {
      const reply = await client.open(request)
      // The identity is what was asked for, not merely a well formed one.
      if (reply.type === 'project.opened' && reply.project.id !== request.projectId) {
        return projectError('invalid-response', reply.requestId)
      }
      return reply
    },
    listProjects: () => client.list(),
    registerProject: () => client.register(),
    relocateProject: (request) => client.relocate(request),
    selectProject: (request) => client.select(request),
  }
}
