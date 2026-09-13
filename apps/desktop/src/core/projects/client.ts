import { requestIdentifier } from '../../boundary'
import { type ProjectError, type ProjectOpenReply, projectError } from './contract'
import type { ProjectListReply } from './messages'
import { PROJECT_OPERATIONS } from './operations'

export type ProjectClient = {
  openProject(request: { projectId: string }): Promise<ProjectOpenReply>
  listProjects(): Promise<ProjectListReply>
  registerProject(): Promise<ProjectListReply>
  relocateProject(request: { projectId: string }): Promise<ProjectListReply>
}

export function createProjectClient(
  invoke: (operation: keyof typeof PROJECT_OPERATIONS, request: unknown) => Promise<unknown>,
): ProjectClient {
  // One send for every action. It is the renderer's whole trust boundary: an unrecognised reply,
  // or one answering another request, becomes `invalid-response` rather than reaching a component.
  async function send<T extends { requestId: string | null }>(
    request: unknown,
    operation: keyof typeof PROJECT_OPERATIONS,
    schema: { safeParse(value: unknown): { success: boolean; data?: T } },
  ): Promise<T | ProjectError> {
    const requestId = requestIdentifier(request)
    let reply: unknown
    try {
      reply = await invoke(operation, request)
    } catch {
      return projectError('connection-lost', requestId)
    }
    const parsed = schema.safeParse(reply)
    if (!parsed.success || parsed.data?.requestId !== requestId) {
      return projectError('invalid-response', requestId)
    }
    return parsed.data as T
  }

  return {
    async openProject(request) {
      const message = {
        ...request,
        version: 1,
        type: PROJECT_OPERATIONS.open.name,
        requestId: crypto.randomUUID(),
      }
      const reply = await send(message, 'open', PROJECT_OPERATIONS.open.reply)
      // The identity is what was asked for, not merely a well formed one.
      if (reply.type === 'project.opened' && reply.project.id !== request.projectId) {
        return projectError('invalid-response', requestIdentifier(message))
      }
      return reply
    },
    listProjects: () =>
      send(
        {
          version: 1,
          type: PROJECT_OPERATIONS.list.name,
          requestId: crypto.randomUUID(),
        },
        'list',
        PROJECT_OPERATIONS.list.reply,
      ),
    registerProject: () =>
      send(
        {
          version: 1,
          type: PROJECT_OPERATIONS.register.name,
          requestId: crypto.randomUUID(),
        },
        'register',
        PROJECT_OPERATIONS.register.reply,
      ),
    relocateProject: (request) =>
      send(
        {
          ...request,
          version: 1,
          type: PROJECT_OPERATIONS.relocate.name,
          requestId: crypto.randomUUID(),
        },
        'relocate',
        PROJECT_OPERATIONS.relocate.reply,
      ),
  }
}
