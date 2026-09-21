import type { ProjectSetupActor } from '@/domains/projects/main/setup/project-setup-actor'
import { PROJECT_SETUP_MACHINE_VERSION } from '@/domains/projects/main/setup/project-setup-machine'
import type {
  ProjectSetupSnapshot,
  ProjectSetupStore,
} from '@/domains/projects/main/setup/project-setup-registry'

export function saveProjectSetupRecord({
  actor,
  projectId,
  receipts,
  revision,
  store,
}: {
  actor: ProjectSetupActor
  projectId: string
  receipts: Record<string, ProjectSetupSnapshot>
  revision: number
  store: ProjectSetupStore
}): void {
  store.writeProjectSetup({
    checkpointVersion: 1,
    machineVersion: PROJECT_SETUP_MACHINE_VERSION,
    projectId,
    revision,
    savedAt: new Date().toISOString(),
    persistedSnapshot: actor.getPersistedSnapshot(),
    receipts,
  })
}
