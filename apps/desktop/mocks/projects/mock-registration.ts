// Real git repositories in a temporary tree, and a folder chooser the test answers in place of the dialog.
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import { promisify } from 'node:util'
import { createWriteQueue } from '../../src/core/storage/portable-file'

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
  return {
    root,
    store: {
      registryPath: path.join(root, 'userData', 'portable-v1', 'projects.json'),
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
  const stored = JSON.parse(await readFile(setup.store.registryPath, 'utf8'))
  stored.projects.push({ id: 'project-elsewhere', path: setup.root })
  await writeFile(setup.store.registryPath, JSON.stringify(stored))
}

export const register = (id: string) => ({ version: 1, type: 'project.register', requestId: id })
export const list = (id: string) => ({ version: 1, type: 'project.list', requestId: id })
export const relocate = (id: string, projectId: string) => ({
  version: 1,
  type: 'project.relocate',
  requestId: id,
  projectId,
})
