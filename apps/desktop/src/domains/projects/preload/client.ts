import { createDomainClient } from '../../../core/contract/domain'
import { type ProjectOpenReply, type ProjectSetupReply, projectError } from '../contract/contract'
import type { ProjectListReply } from '../contract/messages'
import { PROJECT_OPERATIONS } from '../contract/operations'

export type ProjectClient = {
  openProject(request: { projectId: string }): Promise<ProjectOpenReply>
  beginProjectSetup(request: { projectId: string }): Promise<ProjectSetupReply>
  saveProjectSetup(request: { projectId: string; source: string }): Promise<ProjectSetupReply>
  validateProjectSetup(request: { projectId: string }): Promise<ProjectSetupReply>
  cancelProjectSetup(request: { projectId: string }): Promise<ProjectSetupReply>
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
      if (
        (reply.type === 'project.opened' || reply.type === 'project.setup-required') &&
        reply.project.id !== request.projectId
      ) {
        return projectError('invalid-response', reply.requestId)
      }
      return reply
    },
    beginProjectSetup: (request) => client.setupBegin(request),
    saveProjectSetup: (request) => client.setupSave(request),
    validateProjectSetup: (request) => client.setupValidate(request),
    cancelProjectSetup: (request) => client.setupCancel(request),
    listProjects: () => client.list(),
    registerProject: () => client.register(),
    relocateProject: (request) => client.relocate(request),
    selectProject: (request) => client.select(request),
  }
}
