import type { ProjectSetupActor } from '@/domains/projects/main/setup/project-setup-actor'
import { PROJECT_SETUP_MACHINE_VERSION } from '@/domains/projects/main/setup/project-setup-machine'
import type { ProjectDatabase } from '@/domains/projects/main/sqlite-store'
import {
  persistedSetupContext,
  projectSetupRecordFromDatabase,
} from './project-setup-persistence-schema'
import type {
  ProjectSetupRecord,
  ProjectSetupSnapshot,
  ProjectSetupStore,
} from './project-setup-registry'

type WriteStatement = { run: (...values: string[]) => unknown }

export function projectSetupStore(
  database: ProjectDatabase,
  afterWrite: () => void,
): ProjectSetupStore {
  const read = database.prepare(
    'SELECT checkpoint_version, machine_version, revision, persisted_snapshot, receipts, saved_at FROM project_setup_actor WHERE project_id = ?',
  )
  const write = database.prepare(
    'INSERT INTO project_setup_actor (project_id, checkpoint_version, machine_version, revision, persisted_snapshot, receipts, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET checkpoint_version = excluded.checkpoint_version, machine_version = excluded.machine_version, revision = excluded.revision, persisted_snapshot = excluded.persisted_snapshot, receipts = excluded.receipts, saved_at = excluded.saved_at',
  )
  const writeEffect = database.prepare(
    'INSERT INTO project_setup_effect (project_id, intent_json, result_json, saved_at) VALUES (?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET intent_json = excluded.intent_json, result_json = excluded.result_json, saved_at = excluded.saved_at',
  )
  const writeRecovery = database.prepare(
    'INSERT INTO project_setup_recovery (project_id, raw_record, reason, saved_at) VALUES (?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET raw_record = excluded.raw_record, reason = excluded.reason, saved_at = excluded.saved_at',
  )
  const writeRecord = (record: ProjectSetupRecord) => {
    writeProjectSetupRecord({ database, record, write, writeEffect })
    afterWrite()
  }
  return {
    readProjectSetup(projectId) {
      const row = read.get(projectId)
      try {
        if (row === undefined || row === null) return null
        const parsed = projectSetupRecordFromDatabase(projectId, row)
        if (parsed.migrated) writeRecord(parsed.record)
        return parsed.record
      } catch (error) {
        writeRecovery.run(projectId, JSON.stringify(row), String(error), new Date().toISOString())
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

function writeProjectSetupRecord({
  database,
  record,
  write,
  writeEffect,
}: {
  database: ProjectDatabase
  record: ProjectSetupRecord
  write: WriteStatement
  writeEffect: WriteStatement
}): void {
  const context = persistedSetupContext(JSON.parse(JSON.stringify(record.persistedSnapshot)))
  database.exec('BEGIN')
  try {
    write.run(
      record.projectId,
      String(record.checkpointVersion),
      String(record.machineVersion),
      String(record.revision),
      JSON.stringify(record.persistedSnapshot),
      JSON.stringify(record.receipts),
      record.savedAt,
    )
    writeEffect.run(
      record.projectId,
      JSON.stringify({
        effect: context.activeEffect,
        attemptNumber: context.attemptNumber,
        applicationSessionId: context.applicationSessionId,
        planningSessionId: context.planningSessionId,
      }),
      JSON.stringify({
        finalDiff: context.finalDiff,
        recoveryMessage: context.recoveryMessage,
      }),
      record.savedAt,
    )
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBack')
    throw error
  }
}
