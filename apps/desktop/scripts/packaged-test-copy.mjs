// A throwaway copy of the packaged app with ONE fuse flipped, so a driver can attach to it.
// Shared by every packaged proof: the copy, the flip and the assertion that the flip reached the
// copy and nothing else are the same work whatever the proof then reads.
import assert from 'node:assert/strict'
import { cp, realpath } from 'node:fs/promises'
import path from 'node:path'
import { FuseV1Options, FuseVersion, flipFuses, pathToFuseFile } from '@electron/fuses'
import { PRODUCTION_FUSE_PROFILE, readFuseWire } from './fuse-profile.mjs'
import { packagedApp } from './packaged-app.mjs'

export async function packagedTestCopy(root, arch = 'arm64') {
  const application = path.join(root, 'Argo.app')
  await cp(packagedApp(arch), application, { recursive: true, verbatimSymlinks: true })
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

// The shipped artifact itself must be untouched by the copy: the proof read a copy, and what
// leaves this machine still carries the production profile.
export async function assertShippedFusesIntact(arch = 'arm64') {
  assert.equal(
    (await readFuseWire(packagedApp(arch))).every((fuse) => fuse.matches),
    true,
  )
}

export function appExecutable(application) {
  return path.join(application, 'Contents', 'MacOS', 'Argo')
}
