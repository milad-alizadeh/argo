#!/usr/bin/env node
// Refuses a packaged Argo.app that cannot run a PTY, from a Forge `postPackage` hook — so
// `forge package` itself is what fails, on the one path every artifact takes, local and CI alike.
// A check that has to be remembered separately is a check that will be skipped.
// [#1769](https://github.com/milad-alizadeh/argo/issues/1769). The checks are in
// `packaged-pty-checks.mjs`; this is the two callers of them.
import path from 'node:path'
import process from 'node:process'
import { archOf, packagedPtyFailures } from './packaged-pty-checks.mjs'

function refusal(appPath, failures) {
  return [
    `${appPath} would ship without a working PTY:`,
    ...failures.map((failure) => `  - ${failure}`),
  ].join('\n')
}

// `postPackage` hands over one output path per architecture packaged.
export async function assertPackagedPty(outputPaths, appName) {
  for (const outputPath of outputPaths) {
    const appPath = path.join(outputPath, `${appName}.app`)
    const failures = await packagedPtyFailures(appPath, archOf(outputPath))
    if (failures.length > 0) throw new Error(refusal(appPath, failures))
  }
}

// Standalone, so a failure can be reproduced against an app already in `out/` without paying for
// another package, and so CI can re-check an artifact it downloaded rather than built.
if (process.argv[1] === import.meta.filename) {
  const appPath = process.argv[2]
  if (!appPath) {
    process.stderr.write('usage: assert-packaged-pty.mjs <path to Argo.app>\n')
    process.exit(2)
  }
  const failures = await packagedPtyFailures(appPath, archOf(path.dirname(appPath)))
  if (failures.length === 0) process.stdout.write(`PASS ${appPath}\n`)
  else process.stderr.write(`${refusal(appPath, failures)}\n`)
  process.exit(failures.length === 0 ? 0 : 1)
}
