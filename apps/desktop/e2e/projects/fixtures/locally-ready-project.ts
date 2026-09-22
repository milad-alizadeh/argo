import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PACKAGED_PROOF_SETUP_DOCUMENT_REVISION } from '../../../mocks/providers/setup/mock-setup-document-loopback'
import { createProjectSetupRegistry } from '@/domains/projects/main/setup/persistence/project-setup-registry'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'

export const LOCALLY_READY_CONFIGURATION = JSON.stringify(
  {
    version: 1,
    targets: {
      app: { default: true, path: '.', setup: 'true', run: 'true', build: 'true', test: 'true' },
    },
  },
  null,
  2,
)
const LOCALLY_READY_CONFIGURATION_SOURCE = `${LOCALLY_READY_CONFIGURATION}\n// Local override\n`

// A selected Project opens only after its commands validate.
export async function makeProjectLocallyReady(projectPath: string) {
  const configurationDirectory = path.join(projectPath, '.argo')
  await mkdir(configurationDirectory, { recursive: true })
  await writeFile(path.join(configurationDirectory, 'settings.json'), LOCALLY_READY_CONFIGURATION)
}

// Non-onboarding packaged proofs need a complete setup record as well as valid commands. Their
// concern is the room they exercise, not the setup path that has already made the Project usable.
export function locallyReadyCheckpoint(projectId: string, projectPath: string) {
  return {
    projectId,
    worktreePath: projectPath,
    phase: 'ready' as const,
    configurationSource: LOCALLY_READY_CONFIGURATION_SOURCE,
    documentRevision: PACKAGED_PROOF_SETUP_DOCUMENT_REVISION,
  }
}

export function markProjectSetupLocallyReady(
  projects: ProjectStore,
  projectId: string,
  projectPath: string,
) {
  projects.writeSetupCheckpoint(locallyReadyCheckpoint(projectId, projectPath))
  const setup = createProjectSetupRegistry(projects)
  setup.transition(projectId, { type: 'Choose manual' })
  setup.transition(projectId, { type: 'Save manual', source: LOCALLY_READY_CONFIGURATION })
}
