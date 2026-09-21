// The packaged copy this proof runs, and the isolated application data it runs against. The copy
// carries the production fuse profile with one fuse flipped, so the run reads a shipped app whose
// only difference from the download is the inspector it is driven through.
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'
import { _electron as electron } from 'playwright-core'
import type { MockSetupDocument } from '../../../mocks/providers/setup/mock-setup-document-loopback'
import { ACCEPTANCE_ENV } from '../../../scripts/acceptance-protocol.mts'
import {
  PROJECT_PROOF_STORE_ENV,
  SETUP_DOCUMENT_PROOF_URL_ENV,
} from '../../../src/domains/projects/main/proof-protocol'
import { createProjectStore } from '../../../src/domains/projects/main/sqlite-store'
import { createDurableDatabase } from '../../../src/platform/main/storage/durable-database'
import { openSharedDatabase } from '../../../src/platform/main/storage/shared-database'
import { sharedDatabasePath } from '../../../src/platform/main/storage/shared-database-path'
import { appExecutable, packagedTestCopy } from '../../packaged-app'
import { makeProjectLocallyReady } from './locally-ready-project'

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
  await makeProjectLocallyReady(projectPath)
  const databasePath = sharedDatabasePath(userData)
  const projects = createProjectStore(createDurableDatabase(openSharedDatabase(userData)))
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

export async function prepareManual(
  root: string,
  application: string,
  setupDocument: MockSetupDocument,
) {
  const userData = path.join(root, 'manual-userData')
  const projectPath = path.join(root, 'manual-project')
  const remote = path.join(root, 'manual-remote.git')
  await mkdir(userData, { recursive: true })
  await repository(projectPath)
  await writeFile(path.join(projectPath, 'README.md'), 'Manual setup fixture\n')
  await run('git', ['-C', projectPath, 'add', 'README.md'])
  await run('git', [
    '-C',
    projectPath,
    '-c',
    'user.email=argo@example.test',
    '-c',
    'user.name=Argo',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  ])
  await run('git', ['init', '--bare', '--quiet', remote])
  await run('git', ['-C', projectPath, 'remote', 'add', 'origin', remote])
  const branch = (await run('git', ['-C', projectPath, 'branch', '--show-current'])).stdout.trim()
  await run('git', ['-C', projectPath, 'push', '--quiet', '-u', 'origin', branch])
  await run('git', ['-C', remote, 'symbolic-ref', 'HEAD', `refs/heads/${branch}`])
  const databasePath = sharedDatabasePath(userData)
  const projects = createProjectStore(createDurableDatabase(openSharedDatabase(userData)))
  projects.replace({
    projects: [
      { id: 'project-setup', path: projectPath, commonDirectory: path.join(projectPath, '.git') },
    ],
    selectedId: 'project-setup',
  })
  projects.close()
  return {
    application,
    databasePath,
    projectPath,
    setupDocument,
    userData,
  }
}

export async function readManualSetupConfiguration(fixture: { databasePath: string }) {
  const projects = createProjectStore(createDurableDatabase(new DatabaseSync(fixture.databasePath)))
  try {
    const checkpoint = projects.readSetupCheckpoint('project-setup')
    if (!checkpoint) throw new Error('Manual setup checkpoint is unavailable.')
    return await readFile(path.join(checkpoint.worktreePath, '.argo', 'settings.json'), 'utf8')
  } finally {
    projects.close()
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
      ...(fixture.setupDocument
        ? { [SETUP_DOCUMENT_PROOF_URL_ENV]: fixture.setupDocument.url }
        : {}),
      ...environment,
      [ACCEPTANCE_ENV]: '0',
    },
    timeout: 30_000,
  })
}
