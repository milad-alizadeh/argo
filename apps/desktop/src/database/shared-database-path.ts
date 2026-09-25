import path from 'node:path'

export function sharedDatabasePath(userData: string): string {
  return path.join(userData, 'argo.sqlite')
}

export function sharedDatabaseBackupPath(userData: string): string {
  return path.join(userData, 'argo.backup.sqlite')
}
