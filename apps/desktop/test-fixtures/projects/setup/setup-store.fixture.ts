import type { SetupDocument } from '@/domains/projects/contract/setup-document'
import type { SetupCheckpoint } from '@/domains/projects/main/sqlite-store'

export function setupStoreFixture(
  project: string,
  document: SetupDocument,
  initialCheckpoint: SetupCheckpoint | null = null,
) {
  let checkpoint = initialCheckpoint
  return {
    checkpoint: () => checkpoint,
    store: {
      projects: {
        read: () => ({
          projects: [{ id: 'project-1', path: project, commonDirectory: project }],
          selectedId: 'project-1',
        }),
        readSetupCheckpoint: () => checkpoint,
        updateProjectPath: () => undefined,
        writeSetupCheckpoint: (next: SetupCheckpoint) => {
          checkpoint = next
        },
      },
      loadSetupDocument: async () => document,
    },
  }
}
