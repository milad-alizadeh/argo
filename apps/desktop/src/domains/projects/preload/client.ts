import {
  type ProjectOpenReply,
  type ProjectSetupCommand,
  type ProjectSetupReply,
  projectError,
  projectSetupSnapshotSchema,
} from '@/domains/projects/contract/contract'
import type { ProjectListReply } from '@/domains/projects/contract/messages'
import { PROJECT_OPERATIONS } from '@/domains/projects/contract/operations'
import { createDomainClient } from '@/shared/ipc/client'

export type ProjectClient = {
  openProject(request: { projectId: string }): Promise<ProjectOpenReply>
  projectSetupSnapshot(request: { projectId: string }): Promise<ProjectSetupReply>
  sendProjectSetupCommand(request: {
    projectId: string
    commandId: string
    expectedRevision: number
    command: ProjectSetupCommand
  }): Promise<ProjectSetupReply>
  subscribeProjectSetup(projectId: string, listener: (reply: ProjectSetupReply) => void): () => void
  listProjects(): Promise<ProjectListReply>
  registerProject(): Promise<ProjectListReply>
  relocateProject(request: { projectId: string }): Promise<ProjectListReply>
  selectProject(request: { projectId: string }): Promise<ProjectListReply>
}

export function createProjectClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
  subscribe: (channel: string, listener: (value: unknown) => void) => () => void = () => () => {},
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
    projectSetupSnapshot: (request) => client.setupSnapshot(request),
    sendProjectSetupCommand: (request) => client.setupCommand(request),
    subscribeProjectSetup: (projectId, listener) =>
      subscribe('argo:project:setup:changed', (value) => {
        const parsed = projectSetupSnapshotSchema.safeParse(value)
        if (parsed.success && parsed.data.projectId === projectId) listener(parsed.data)
      }),
    listProjects: () => client.list(),
    registerProject: () => client.register(),
    relocateProject: (request) => client.relocate(request),
    selectProject: (request) => client.select(request),
  }
}
