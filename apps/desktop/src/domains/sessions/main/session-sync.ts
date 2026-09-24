import type { ProjectPort } from '@/domains/projects/main'
import { discoveredSessionSchema } from '@/domains/sessions/contract/session-discovery'
import type { SessionAdapterRegistry } from '@/domains/sessions/next/main/session-adapter-registry'
import type { SessionRepository } from './session-repository'

export async function syncSessions(
  repository: SessionRepository,
  adapters: Pick<SessionAdapterRegistry, 'discoverSessions' | 'readKnownSession'>,
  projects: Pick<ProjectPort, 'projectForWorkspace'>,
): Promise<{ indexed: number; unavailableWorkspaces: number; failedWrites: number }> {
  let indexed = 0
  let unavailableWorkspaces = 0
  let failedWrites = 0
  for (const rawSession of await adapters.discoverSessions()) {
    const parsed = discoveredSessionSchema.safeParse(rawSession)
    if (!parsed.success) {
      failedWrites += 1
      continue
    }
    const discovered = parsed.data
    const projectId = projects.projectForWorkspace(discovered.workspaceId)
    if (projectId === null) {
      unavailableWorkspaces += 1
      continue
    }
    try {
      repository.upsert({
        harness: discovered.harness,
        nativeId: discovered.nativeId,
        projectId,
        firstPrompt: discovered.firstPrompt,
      })
      indexed += 1
    } catch {
      failedWrites += 1
    }
  }
  await repository.reconcileVendorReads((session) => adapters.readKnownSession(session))
  return { indexed, unavailableWorkspaces, failedWrites }
}
