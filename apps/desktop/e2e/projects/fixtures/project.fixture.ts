// The packaged copy this proof runs, and the isolated application data it runs against. The copy
// carries the production fuse profile with one fuse flipped, so the run reads a shipped app whose
// only difference from the download is the inspector it is driven through.
import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { _electron as electron } from 'playwright-core'
import { databasePath, openDatabase } from '@/database/database'
import { project as projectTable } from '@/database/project/schema'
import { PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { ACCEPTANCE_ENV } from '../../../scripts/acceptance-protocol.mts'
import { appExecutable, packagedTestCopy } from '../../packaged-app'
import { makeProjectLocallyReady } from './locally-ready-project'

const run = promisify(execFile)

// The one project entry every fixture in this proof suite seeds before it launches the app.
export function seedSingleProject(userData: string, project: { id: string; path: string }) {
  const { id, path: projectPath } = project
  const database = openDatabase(userData)
  database
    .insert(projectTable)
    .values({ id, path: projectPath, commonDirectory: path.join(projectPath, '.git') })
    .run()
  database.$client.close()
}

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
  await makeProjectLocallyReady(projectPath)
  const applicationDatabasePath = databasePath(userData)
  seedSingleProject(userData, { id: 'project-1', path: projectPath })
  return {
    application,
    userData,
    projectPath,
    databasePath: applicationDatabasePath,
    beta: await repository(path.join(root, 'beta')),
    moved: path.join(root, 'beta-moved'),
    relocated: path.join(root, 'beta-relocated'),
    plain: await folder(path.join(root, 'plain')),
  }
}

// One launch of the packaged app against the fixture's own application data. A restart is another
// call to this, which is the only honest way to prove what survives one.
export function launch(fixture, environment: Record<string, string> = {}) {
  return electron.launch({
    executablePath: appExecutable(fixture.application),
    env: {
      ...process.env,
      [PROJECT_PROOF_STORE_ENV]: fixture.userData,
      ...environment,
      [ACCEPTANCE_ENV]: '0',
    },
    timeout: 30_000,
  })
}
