import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, test } from 'vitest'
import { sharedDatabaseBackupPath, sharedDatabasePath } from '@/database/shared-database-path'
import { resetIncompleteDevelopmentDatabase } from './reset-incomplete-database'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

test('resets a development database with tables but no migration history', async () => {
  const projectData = await mkdtemp(path.join(os.tmpdir(), 'argo-incomplete-development-database-'))
  roots.push(projectData)
  const database = new DatabaseSync(sharedDatabasePath(projectData))
  database.exec('CREATE TABLE __drizzle_migrations (name TEXT NOT NULL)')
  database.exec('CREATE TABLE project (id TEXT PRIMARY KEY)')
  database.close()
  const backup = new DatabaseSync(sharedDatabaseBackupPath(projectData))
  backup.exec('CREATE TABLE project (id TEXT PRIMARY KEY)')
  backup.close()

  expect(resetIncompleteDevelopmentDatabase(projectData)).toBe(true)
  expect(existsSync(sharedDatabasePath(projectData))).toBe(false)
  expect(existsSync(sharedDatabaseBackupPath(projectData))).toBe(false)
})

test('keeps a development database with recorded migrations', async () => {
  const projectData = await mkdtemp(path.join(os.tmpdir(), 'argo-complete-development-database-'))
  roots.push(projectData)
  const databasePath = sharedDatabasePath(projectData)
  const database = new DatabaseSync(databasePath)
  database.exec('CREATE TABLE __drizzle_migrations (name TEXT NOT NULL)')
  database.exec("INSERT INTO __drizzle_migrations (name) VALUES ('first')")
  database.exec('CREATE TABLE project (id TEXT PRIMARY KEY)')
  database.close()

  expect(resetIncompleteDevelopmentDatabase(projectData)).toBe(false)
  expect(existsSync(databasePath)).toBe(true)
})
