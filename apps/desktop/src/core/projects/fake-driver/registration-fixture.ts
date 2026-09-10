// The fixture both registration suites run against: real git repositories in a temporary tree,
// and a chooser the test answers. The chooser is the seam: the suite answers it with a path, the
// packaged proof answers it with a stubbed `dialog.showOpenDialog`, and nothing test-only ships.
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

export async function repository(root, name) {
  const folder = path.join(root, name)
  await mkdir(folder, { recursive: true })
  await run('git', ['-C', folder, 'init', '--quiet'])
  return folder
}

export async function fixture(context) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-registration-')))
  context.after(() => rm(root, { recursive: true, force: true }))
  const chosen = { folder: null, during: null }
  return {
    root,
    store: {
      registryPath: path.join(root, 'userData', 'portable-v1', 'projects.json'),
      chooseFolder: async () => {
        // Whatever the machine does while the chooser is open. A modal chooser can stay open for
        // minutes, and the registry is a file another window of the app writes.
        if (chosen.during) await chosen.during()
        return chosen.folder
      },
    },
    choose(folder) {
      chosen.folder = folder
    },
    duringChoice(work) {
      chosen.during = work
    },
  }
}

// Another window of the app registering a Project of its own, while this suite's chooser is open.
export async function registerElsewhere(setup) {
  const stored = JSON.parse(await readFile(setup.store.registryPath, 'utf8'))
  stored.projects.push({ id: 'project-elsewhere', path: setup.root })
  await writeFile(setup.store.registryPath, JSON.stringify(stored))
}

export const register = (id) => ({ version: 1, type: 'project.register', requestId: id })
export const list = (id) => ({ version: 1, type: 'project.list', requestId: id })
export const relocate = (id, projectId) => ({
  version: 1,
  type: 'project.relocate',
  requestId: id,
  projectId,
})
