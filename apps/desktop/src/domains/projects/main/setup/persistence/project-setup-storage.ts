import { eq } from 'drizzle-orm'
import {
  projectSetupActor,
  projectSetupEffect,
  projectSetupRecovery,
} from '@/database/project-tables'
import type { ProjectDatabase } from '../../sqlite-store'
import type { ProjectSetupActor } from '../project-setup-actor'
import { PROJECT_SETUP_MACHINE_VERSION } from '../project-setup-machine'
import {
  persistedSetupContext,
  projectSetupRecordFromDatabase,
} from './project-setup-persistence-schema'
import type {
  ProjectSetupRecord,
  ProjectSetupSnapshot,
  ProjectSetupStore,
} from './project-setup-registry'

export function projectSetupStore(
  database: ProjectDatabase,
  afterWrite: () => void,
): ProjectSetupStore {
  const writeRecord = (record: ProjectSetupRecord) => {
    writeProjectSetupRecord(database, record)
    afterWrite()
  }
  return {
    readProjectSetup(projectId) {
      const row = database
        .select({
          checkpointVersion: projectSetupActor.checkpointVersion,
          machineVersion: projectSetupActor.machineVersion,
          revision: projectSetupActor.revision,
          persistedSnapshot: projectSetupActor.persistedSnapshot,
          receipts: projectSetupActor.receipts,
          savedAt: projectSetupActor.savedAt,
        })
        .from(projectSetupActor)
        .where(eq(projectSetupActor.projectId, projectId))
        .get()
      try {
        if (!row) return null
        const parsed = projectSetupRecordFromDatabase(projectId, row)
        if (parsed.migrated) writeRecord(parsed.record)
        return parsed.record
      } catch (error) {
        database
          .insert(projectSetupRecovery)
          .values({
            projectId,
            rawRecord: JSON.stringify(row),
            reason: String(error),
            savedAt: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: projectSetupRecovery.projectId,
            set: {
              rawRecord: JSON.stringify(row),
              reason: String(error),
              savedAt: new Date().toISOString(),
            },
          })
          .run()
        return null
      }
    },
    writeProjectSetup: writeRecord,
  }
}

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

function writeProjectSetupRecord(database: ProjectDatabase, record: ProjectSetupRecord): void {
  const context = persistedSetupContext(JSON.parse(JSON.stringify(record.persistedSnapshot)))
  const actor = {
    projectId: record.projectId,
    checkpointVersion: record.checkpointVersion,
    machineVersion: record.machineVersion,
    revision: record.revision,
    persistedSnapshot: JSON.stringify(record.persistedSnapshot),
    receipts: JSON.stringify(record.receipts),
    savedAt: record.savedAt,
  }
  const effect = {
    projectId: record.projectId,
    intentJson: JSON.stringify({
      effect: context.activeEffect,
      attemptNumber: context.attemptNumber,
      applicationSessionId: context.applicationSessionId,
      planningSessionId: context.planningSessionId,
    }),
    resultJson: JSON.stringify({
      finalDiff: context.finalDiff,
      recoveryMessage: context.recoveryMessage,
    }),
    savedAt: record.savedAt,
  }
  database.transaction((transaction) => {
    transaction
      .insert(projectSetupActor)
      .values(actor)
      .onConflictDoUpdate({ target: projectSetupActor.projectId, set: actor })
      .run()
    transaction
      .insert(projectSetupEffect)
      .values(effect)
      .onConflictDoUpdate({ target: projectSetupEffect.projectId, set: effect })
      .run()
  })
}
