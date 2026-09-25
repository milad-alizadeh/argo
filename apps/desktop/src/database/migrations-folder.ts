import path from 'node:path'
import { storageRunsPackagedApplication } from './storage-runtime'

export function databaseMigrationsFolder(): string {
  return storageRunsPackagedApplication()
    ? path.join(process.resourcesPath, 'app.asar', 'drizzle')
    : path.resolve(process.cwd(), 'drizzle')
}
