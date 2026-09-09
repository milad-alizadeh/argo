#!/usr/bin/env node
// Refuses a packaged Argo.app that cannot run a PTY, from a Forge `postPackage` hook — so
// `forge package` itself is what fails, on the one path every artifact takes, local and CI alike.
// A check that has to be remembered separately is a check that will be skipped.
// [#1769](https://github.com/milad-alizadeh/argo/issues/1769). The checks are in
// `packaged-pty-checks.mjs`; this is the two callers of them.
import path from 'node:path'
import process from 'node:process'
import { archOf, archOfBinary, packagedPtyFailures } from './packaged-pty-checks.mjs'

function refusal(appPath, failures) {
  return [
    `${appPath} would ship without a working PTY:`,
    ...failures.map((failure) => `  - ${failure}`),
  ].join('\n')
}

// `postPackage` hands over one output path per architecture packaged. Zero of them means Forge
// packaged nothing, and a loop over nothing is a gate that passes because it never looked.
export async function assertPackagedPty(outputPaths, appName) {
  if (outputPaths.length === 0)
    throw new Error('postPackage received no output paths, so nothing was checked')
  for (const outputPath of outputPaths) {
    const appPath = path.join(outputPath, `${appName}.app`)
    const failures = await packagedPtyFailures(appPath, archOf(outputPath))
    if (failures.length > 0) throw new Error(refusal(appPath, failures))
  }
}

// Standalone, so a failure can be reproduced against an app already in `out/` without paying for
// another package, and so a downloaded release artifact can be checked the same way. Forge's own
// `out/Argo-darwin-arm64/` names the architecture; `/Applications/Argo.app` does not, so fall back
// to reading the Mach-O header rather than refusing a perfectly good app.
if (process.argv[1] === import.meta.filename) {
  const appPath = process.argv[2]
  if (!appPath) {
    process.stderr.write('usage: assert-packaged-pty.mjs <path to Argo.app>\n')
    process.exit(2)
  }
  const arch = archOf(path.dirname(appPath)) ?? archOfBinary(appPath)
  const failures = await packagedPtyFailures(appPath, arch)
  if (failures.length === 0) process.stdout.write(`PASS ${appPath} (${arch})\n`)
  else process.stderr.write(`${refusal(appPath, failures)}\n`)
  process.exit(failures.length === 0 ? 0 : 1)
}
