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
import { signedInHarnessEnvironment } from '../../../mocks/cli/signed-in-harness'
import { ACCEPTANCE_ENV } from '../../../scripts/acceptance-protocol.mts'
import { applicationUnderTest, launchCommand } from '../../application-under-test'
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

export async function repository(folder: string) {
  await mkdir(folder, { recursive: true })
  await run('git', ['-C', folder, 'init', '--quiet'])
  return folder
}

// A caller that already holds the app under test passes it; a standalone tool gets its own.
export async function prepare(root: string, application?: string) {
  application ??= await applicationUnderTest(root)
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
  }
}

// One launch of the app against the fixture's own application data. A restart is another
// call to this, which is the only honest way to prove what survives one.
export async function launch(
  fixture: { application: string; userData: string },
  environment: Record<string, string> = {},
) {
  return electron.launch({
    ...launchCommand(fixture.application),
    env: {
      ...process.env,
      ...(await signedInHarnessEnvironment(path.dirname(fixture.userData))),
      [PROJECT_PROOF_STORE_ENV]: fixture.userData,
      ...environment,
      [ACCEPTANCE_ENV]: '0',
    },
    timeout: 30_000,
  })
}
