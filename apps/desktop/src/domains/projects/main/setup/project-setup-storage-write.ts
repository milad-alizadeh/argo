import type { ProjectDatabase } from '@/domains/projects/main/sqlite-store'
import { persistedSetupContext } from './project-setup-persistence-schema'
import type { ProjectSetupRecord } from './project-setup-registry'

type WriteStatement = { run: (...values: string[]) => unknown }

export function writeProjectSetupRecord({
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
    database.exec('ROLLBACK')
    throw error
  }
}
