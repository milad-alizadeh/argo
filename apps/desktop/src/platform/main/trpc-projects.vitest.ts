import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { project } from '@/database/project/schema'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { type AppRouterDependencies, createAppRouter } from './trpc-router'

test('opens a registered Project without ProjectSetup state', async () => {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), 'argo-project-'))
  const database = migratedDatabase()
  try {
    database
      .insert(project)
      .values({
        id: 'project-1',
        path: projectPath,
        commonDirectory: path.join(projectPath, '.git'),
      })
      .run()
    const dependencies = {
      projects: {
        database,
        chooseFolder: async () => null,
        exclusive: async <T>(work: () => Promise<T>) => work(),
      },
      sessions: { database, supervisor: { send: () => {} } },
    } as unknown as AppRouterDependencies

    await expect(
      createAppRouter(dependencies).createCaller({}).projectOpen('project-1'),
    ).resolves.toEqual({
      id: 'project-1',
      name: path.basename(projectPath),
      path: projectPath,
    })
  } finally {
    database.$client.close()
    await rm(projectPath, { recursive: true, force: true })
  }
})
