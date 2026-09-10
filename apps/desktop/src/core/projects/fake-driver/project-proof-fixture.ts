// The packaged copy this proof runs, and the isolated application data it runs against. The copy
// carries the production fuse profile with one fuse flipped, so the run reads a shipped app whose
// only difference from the download is the inspector it is driven through.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { cp, mkdir, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { FuseV1Options, FuseVersion, flipFuses, pathToFuseFile } from '@electron/fuses'
import { _electron as electron } from 'playwright-core'
import { ACCEPTANCE_ENV } from '../../../../scripts/acceptance-protocol.mjs'
import { PRODUCTION_FUSE_PROFILE, readFuseWire } from '../../../../scripts/fuse-profile.mjs'
import { packagedApp } from '../../../../scripts/packaged-app.mjs'
import { PROJECT_PROOF_STORE_ENV } from './project-proof-protocol'

const run = promisify(execFile)

export async function repository(folder) {
  await mkdir(folder, { recursive: true })
  await run('git', ['-C', folder, 'init', '--quiet'])
  return folder
}

async function copyApplication(root) {
  const application = path.join(root, 'Argo.app')
  await cp(packagedApp('arm64'), application, { recursive: true, verbatimSymlinks: true })
  const copiedRoot = await realpath(application)
  assert.equal(
    (await realpath(pathToFuseFile(application))).startsWith(`${copiedRoot}${path.sep}`),
    true,
  )
  await flipFuses(application, {
    version: FuseVersion.V1,
    ...PRODUCTION_FUSE_PROFILE,
    [FuseV1Options.EnableNodeCliInspectArguments]: true,
    resetAdHocDarwinSignature: true,
    strictlyRequireAllFuses: true,
  })
  const changedFuses = (await readFuseWire(application)).filter((fuse) => !fuse.matches)
  assert.deepEqual(
    changedFuses.map((fuse) => fuse.fuse),
    ['EnableNodeCliInspectArguments'],
  )
  return application
}

// A folder with no git root in it. The chooser can be answered with one, so the app has to turn it
// away by name rather than by failing to read it.
async function folder(at) {
  await mkdir(at, { recursive: true })
  return at
}

export async function prepare(root) {
  const application = await copyApplication(root)
  const userData = path.join(root, 'userData')
  const projectPath = path.join(root, 'example')
  await mkdir(path.join(userData, 'portable-v1'), { recursive: true })
  await mkdir(projectPath)
  const registryPath = path.join(userData, 'portable-v1', 'projects.json')
  await writeFile(
    registryPath,
    JSON.stringify({
      version: 1,
      projects: [
        { id: 'project-1', path: projectPath, bindings: [{ token: 'must-stay-private' }] },
      ],
    }),
  )
  return {
    application,
    userData,
    projectPath,
    registryPath,
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
    executablePath: path.join(fixture.application, 'Contents', 'MacOS', 'Argo'),
    env: { ...process.env, [PROJECT_PROOF_STORE_ENV]: fixture.userData, [ACCEPTANCE_ENV]: '0' },
    timeout: 30_000,
  })
}

export function readProduction() {
  return readFuseWire(packagedApp('arm64'))
}
