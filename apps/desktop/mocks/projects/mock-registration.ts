// Real git repositories in a temporary tree, and a folder chooser the test answers in place of the dialog.

import { Database } from 'bun:sqlite'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import { promisify } from 'node:util'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { createProjectStore } from '../../src/domains/projects/main/sqlite-store'
import { createWriteQueue } from '../../src/platform/main/storage/portable-file'

const run = promisify(execFile)

export async function repository(root: string, name: string) {
  const folder = path.join(root, name)
  await mkdir(folder, { recursive: true })
  await run('git', ['-C', folder, 'init', '--quiet'])
  return folder
}

export type RegistrationFixture = Awaited<ReturnType<typeof fixture>>

export async function fixture(context: TestContext) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-registration-')))
  context.after(() => rm(root, { recursive: true, force: true }))
  const chosen: {
    folder: string | null
    during: (() => Promise<void>) | null
    queue: Array<string | null> | null
  } = { folder: null, during: null, queue: null }
  await mkdir(path.join(root, 'userData'), { recursive: true })
  const database = new Database(path.join(root, 'userData', 'argo.sqlite'))
  migrate(drizzle({ client: database }), {
    migrationsFolder: path.resolve(import.meta.dirname, '../../drizzle'),
  })
  const projects = createProjectStore(drizzle({ client: database }))
  context.after(() => projects.close())
  return {
    root,
    store: {
      projects,
      chooseFolder: async () => {
        // A modal chooser can stay open for minutes while another window writes the registry.
        if (chosen.during) await chosen.during()
        if (chosen.queue) return chosen.queue.shift() ?? null
        return chosen.folder
      },
      exclusive: createWriteQueue(),
    },
    choose(folder: string | null) {
      chosen.folder = folder
    },
    // The write queue serializes the choosers, so the first call in gets the first answer.
    chooseEach(folders: Array<string | null>) {
      chosen.queue = [...folders]
    },
    duringChoice(work: () => Promise<void>) {
      chosen.during = work
    },
  }
}

// Another window of the app registering a Project of its own, while this suite's chooser is open.
export async function registerElsewhere(setup: RegistrationFixture) {
  const registry = setup.store.projects.read()
  setup.store.projects.replace({
    ...registry,
    projects: [
      ...registry.projects,
      { id: 'project-elsewhere', path: setup.root, commonDirectory: path.join(setup.root, '.git') },
    ],
  })
}

export const register = (id: string) => ({ version: 1, type: 'project.register', requestId: id })
export const list = (id: string) => ({ version: 1, type: 'project.list', requestId: id })
export const relocate = (id: string, projectId: string) => ({
  version: 1,
  type: 'project.relocate',
  requestId: id,
  projectId,
})
