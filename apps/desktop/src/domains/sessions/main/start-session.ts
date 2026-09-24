import type { ProjectPort } from '@/domains/projects/main'
import type {
  SessionStartInput,
  SessionStartOutput,
} from '@/domains/sessions/contract/session-start'
import type { SessionAdapterRegistry } from '@/domains/sessions/next/main/session-adapter-registry'
import type { SessionIdentityService } from './session-identity-service'

function commitStarted(
  identity: SessionIdentityService,
  intentId: string,
  nativeId: string,
): SessionStartOutput {
  identity.rememberVendorStart(intentId, nativeId)
  try {
    return { kind: 'started', argoId: identity.commitLaunch(intentId, nativeId) }
  } catch {
    return { kind: 'uncertain' }
  }
}

export function createSessionStarter(options: {
  identity: SessionIdentityService
  projects: ProjectPort
  adapters: SessionAdapterRegistry
}): (input: SessionStartInput) => Promise<SessionStartOutput> {
  return async (input) => {
    if (options.identity.isUnsafe()) return { kind: 'rejected', reason: 'Argo storage is unsafe.' }
    const adapter = options.adapters.adapterFor(input.harness)
    if (adapter === undefined) return { kind: 'rejected', reason: 'The Harness is unavailable.' }
    const resolved = await options.projects.resolveWorkspace(input.workspace)
    const projectId = options.projects.projectForWorkspace(resolved.workspaceId)
    if (projectId === null) return { kind: 'rejected', reason: 'The Workspace is unavailable.' }
    let intentId: string
    try {
      intentId = options.identity.beginLaunch({
        harness: input.harness,
        projectId,
        workspaceId: resolved.workspaceId,
        prompt: input.prompt,
      })
    } catch {
      return { kind: 'rejected', reason: 'Argo storage is unsafe.' }
    }
    try {
      const result = await adapter.execute({
        type: 'session.start',
        ...input,
        workspace: { kind: 'existing', workspaceId: resolved.workspaceId },
      })
      switch (result.kind) {
        case 'rejected':
          options.identity.rejectLaunch(intentId)
          return result
        case 'uncertain':
          options.identity.rememberVendorStart(intentId, result.session?.nativeId ?? null)
          return { kind: 'uncertain' }
        case 'accepted':
          return commitStarted(options.identity, intentId, result.projection.session.nativeId)
      }
    } catch {
      options.identity.rememberVendorStart(intentId, null)
      return { kind: 'uncertain' }
    }
  }
}
