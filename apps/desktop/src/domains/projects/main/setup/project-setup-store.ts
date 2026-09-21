import { z } from 'zod'
import type { ProjectDatabase } from '@/domains/projects/main/sqlite-store'
import { PROJECT_SETUP_MACHINE_VERSION } from './project-setup-machine'
import type { ProjectSetupRecord } from './project-setup-registry'

export function projectSetupStorage(database: ProjectDatabase) {
  const read = database.prepare(
    'SELECT checkpoint_version, machine_version, revision, persisted_snapshot, receipts, saved_at FROM project_setup_actor WHERE project_id = ?',
  )
  const write = database.prepare(
    'INSERT INTO project_setup_actor (project_id, checkpoint_version, machine_version, revision, persisted_snapshot, receipts, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET checkpoint_version = excluded.checkpoint_version, machine_version = excluded.machine_version, revision = excluded.revision, persisted_snapshot = excluded.persisted_snapshot, receipts = excluded.receipts, saved_at = excluded.saved_at',
  )
  return {
    read(projectId: string): ProjectSetupRecord | null {
      const row = read.get(projectId)
      return row === undefined || row === null ? null : projectSetupRecord(projectId, row)
    },
    write(record: ProjectSetupRecord): void {
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
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
  }
}

const projectSetupRowSchema = z.strictObject({
  checkpoint_version: z.literal(1),
  machine_version: z.literal(PROJECT_SETUP_MACHINE_VERSION),
  revision: z.number().int().nonnegative(),
  persisted_snapshot: z.string(),
  receipts: z.string(),
  saved_at: z.string().datetime(),
})

const projectSetupSnapshotSchema = z.strictObject({
  children: z.record(z.string(), z.unknown()),
  context: z.strictObject({ manualSource: z.string() }),
  historyValue: z.record(z.string(), z.unknown()),
  status: z.literal('active'),
  value: z.enum(['choosingMethod', 'manual', 'deferred', 'ready']),
})

function projectSetupRecord(projectId: string, value: unknown): ProjectSetupRecord {
  const row = projectSetupRowSchema.parse(value)
  const persistedSnapshot = projectSetupSnapshotSchema.parse(JSON.parse(row.persisted_snapshot))
  const receipts = projectSetupReceiptSchema.parse(JSON.parse(row.receipts))
  return {
    checkpointVersion: row.checkpoint_version,
    machineVersion: row.machine_version,
    projectId,
    revision: row.revision,
    savedAt: row.saved_at,
    persistedSnapshot: persistedSnapshot as unknown as ProjectSetupRecord['persistedSnapshot'],
    receipts,
  }
}

const projectSetupReceiptSchema = z.record(
  z.string(),
  z.strictObject({
    projectId: z.string(),
    revision: z.number().int().nonnegative(),
    screen: z.enum(['choosing-method', 'manual', 'deferred', 'ready']),
    manualSource: z.string(),
  }),
)
