// The packaged copy this proof runs, and the isolated application data it runs against. The copy
// carries the production fuse profile with one fuse flipped, so the run reads a shipped app whose
// only difference from the download is the inspector it is driven through.
import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../scripts/acceptance-protocol.mjs'
import { PROJECT_PROOF_STORE_ENV } from '../../../src/domains/projects/main/proof-protocol'
import { createProjectStore } from '../../../src/domains/projects/main/sqlite-store'
import { sharedDatabasePath } from '../../../src/platform/main/storage/shared-database'
import { appExecutable, packagedTestCopy } from '../../packaged-app'

const run = promisify(execFile)

export async function repository(folder) {
  await mkdir(folder, { recursive: true })
  await run('git', ['-C', folder, 'init', '--quiet'])
  return folder
}

// A folder with no git root in it. The chooser can be answered with one, so the app has to turn it
// away by name rather than by failing to read it.
async function folder(at) {
  await mkdir(at, { recursive: true })
  return at
}

// A caller that already holds a packaged copy passes it; a standalone tool gets its own.
export async function prepare(root, application?) {
  application ??= await packagedTestCopy(root)
  const userData = path.join(root, 'userData')
  const projectPath = path.join(root, 'example')
  await mkdir(userData, { recursive: true })
  await mkdir(projectPath)
  const databasePath = sharedDatabasePath(userData)
  const projects = createProjectStore(new DatabaseSync(databasePath))
  projects.replace({
    projects: [
      { id: 'project-1', path: projectPath, commonDirectory: path.join(projectPath, '.git') },
    ],
    selectedId: 'project-1',
  })
  projects.close()
  return {
    application,
    userData,
    projectPath,
    databasePath,
    beta: await repository(path.join(root, 'beta')),
    moved: path.join(root, 'beta-moved'),
    relocated: path.join(root, 'beta-relocated'),
    plain: await folder(path.join(root, 'plain')),
  }
}

// One launch of the packaged app against the fixture's own application data. A restart is another
// call to this, which is the only honest way to prove what survives one.
export function launch(fixture) {
  return electron.launch({
    executablePath: appExecutable(fixture.application),
    env: { ...process.env, [PROJECT_PROOF_STORE_ENV]: fixture.userData, [ACCEPTANCE_ENV]: '0' },
    timeout: 30_000,
  })
}
