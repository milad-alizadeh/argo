import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { backup, type DatabaseSync } from 'node:sqlite'

export function sharedDatabasePath(userData: string): string {
  return path.join(userData, 'argo.sqlite')
}

export function sharedDatabaseBackupPath(userData: string): string {
  return path.join(userData, 'argo.backup.sqlite')
}

export async function backupSharedDatabase(
  database: DatabaseSync,
  backupPath: string,
): Promise<void> {
  await backup(database, backupPath)
}

export function restoreSharedDatabase(databasePath: string, backupPath: string): boolean {
  if (!existsSync(backupPath)) return false
  copyFileSync(backupPath, databasePath)
  return true
}
