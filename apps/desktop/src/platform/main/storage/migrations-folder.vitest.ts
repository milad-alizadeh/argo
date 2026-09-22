import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { databaseMigrationsFolder } from '@/platform/main/storage/migrations-folder'
import { configureStorageRuntime } from '@/platform/main/storage/storage-runtime'

afterEach(() => configureStorageRuntime(false))

test('uses the project migrations while the app runs in development', () => {
  configureStorageRuntime(false)

  expect(databaseMigrationsFolder()).toBe(path.resolve(process.cwd(), 'drizzle'))
})
