import type { ProjectPort } from '@/domains/projects/main'
import type {
  SessionStartInput,
  SessionStartOutput,
} from '@/domains/sessions/contract/session-start'
import type { SessionAdapterRegistry } from '@/domains/sessions/next/main/session-adapter-registry'
import type { SessionRepository } from './session-repository'

export function createSessionStarter(options: {
  repository: SessionRepository
  projects: ProjectPort
  adapters: SessionAdapterRegistry
}): (input: SessionStartInput) => Promise<SessionStartOutput> {
  return async (input) => {
    const adapter = options.adapters.adapterFor(input.harness)
    if (adapter === undefined) return { kind: 'rejected', reason: 'The Harness is unavailable.' }
    const resolved = await options.projects
      .resolveWorkspace(input.workspace)
      .then((workspace) => ({
        ...workspace,
        projectId: options.projects.projectForWorkspace(workspace.workspaceId),
      }))
      .catch(() => null)
    if (resolved?.projectId == null)
      return { kind: 'rejected', reason: 'The Workspace is unavailable.' }
    try {
      const result = await adapter.execute({
        type: 'session.start',
        ...input,
        workspace: { kind: 'existing', workspaceId: resolved.workspaceId },
      })
      switch (result.kind) {
        case 'rejected':
          return result
        case 'uncertain':
          return { kind: 'uncertain' }
        case 'accepted':
          try {
            return {
              kind: 'started',
              argoId: options.repository.upsert({
                harness: input.harness,
                nativeId: result.projection.session.nativeId,
                projectId: resolved.projectId,
                firstPrompt: input.prompt,
              }),
            }
          } catch {
            return { kind: 'uncertain' }
          }
      }
    } catch {
      return { kind: 'uncertain' }
    }
  }
}
