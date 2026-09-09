// The release verdict: one JSON document per release, holding every assertion any tier makes about
// the build, keyed to the SHA-256 of every artifact it judged. ADR-0036 is the contract; this is
// the shape it takes on disk, and the release workflow publishes only when `passed` is true.
//
// One document rather than one per check, because "the check never ran" then reads as a single
// missing file. Every assertion is an entry in `assertions`, so adding one is a field here and a
// line in the workflow, never a report that sits beside the verdict where the publish gate cannot
// see it.
//
// Nothing in here throws on a missing input. A check that could not run has to be as loud as one
// that ran and failed, and a stack trace with no assertion behind it is a silence.

import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { packageManifestAssertion } from './package-manifest.mjs'
import {
  entitlementsAssertion,
  fuseAssertion,
  packagedPtyAssertion,
  signingAssertion,
  updaterAssetAssertion,
} from './release-assertions.mjs'

export const VERDICT_FILENAME = 'release-verdict.json'

export function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

// The hash list is what stops a verdict being inherited: an asset whose SHA-256 is not here is an
// asset the verdict does not cover.
export function artifactDigests(filePaths) {
  return filePaths
    .map((filePath) => ({
      name: path.basename(filePath),
      bytes: statSync(filePath).size,
      sha256: sha256(filePath),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function verdictFailures(verdict) {
  return Object.values(verdict.assertions)
    .filter((assertion) => !assertion.passed)
    .flatMap((assertion) =>
      (assertion.failures ?? [assertion.reason ?? 'failed']).map(
        (failure) => `${assertion.name}: ${failure}`,
      ),
    )
}

export async function buildVerdict({
  version,
  tag,
  appName,
  appPath,
  binaryPath,
  artifactPaths,
  acceptancePath,
  signing,
  run,
}) {
  const artifacts = artifactDigests(artifactPaths)
  const assertions = {
    signing: signingAssertion(signing),
    fuses: await fuseAssertion(binaryPath),
    entitlements: entitlementsAssertion(appPath, appName, { signed: signing.signed }),
    packagedPty: packagedPtyAssertion(acceptancePath),
    packageManifest: packageManifestAssertion(appPath),
    updaterAsset: updaterAssetAssertion(artifacts.map((artifact) => artifact.name)),
  }
  const verdict = {
    version,
    tag,
    app: appName,
    producedAt: new Date().toISOString(),
    run,
    artifacts,
    assertions,
  }
  const failures = verdictFailures(verdict)
  return { ...verdict, failures, passed: failures.length === 0 }
}
