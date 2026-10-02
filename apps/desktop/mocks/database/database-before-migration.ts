// A database stopped just before one migration, seeded with old rows, then migrated to the latest.
import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { onTestFinished } from 'vitest'
import { databaseMigrationsFolder, openDatabase } from '@/database/database'

// Seeds the database every migration before `migration` built, then runs every migration.
export async function migratedFromBefore(migration: string, seed: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-migration-'))
  const earlier = path.join(root, 'migrations')
  await cp(databaseMigrationsFolder(), earlier, {
    recursive: true,
    filter: (source) => {
      const [name = ''] = path.relative(databaseMigrationsFolder(), source).split(path.sep)
      return name < migration
    },
  })
  const userData = path.join(root, 'user-data')
  const seeded = openDatabase(userData, { migrationsFolder: earlier }).$client
  seeded.exec(seed)
  seeded.close()
  const client = openDatabase(userData, { migrationsFolder: databaseMigrationsFolder() }).$client
  onTestFinished(async () => {
    client.close()
    await rm(root, { recursive: true })
  })
  return client
}
