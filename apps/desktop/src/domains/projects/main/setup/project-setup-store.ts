import type { ProjectDatabase } from '@/domains/projects/main/sqlite-store'
import { projectSetupRecordFromDatabase } from './project-setup-persistence-schema'
import type { ProjectSetupRecord } from './project-setup-registry'
import { writeProjectSetupRecord } from './project-setup-storage-write'

export function projectSetupStorage(database: ProjectDatabase) {
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
  const writeRecord = (record: ProjectSetupRecord) =>
    writeProjectSetupRecord({ database, record, write, writeEffect })
  return {
    read(projectId: string): ProjectSetupRecord | null {
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
    write: writeRecord,
  }
}
