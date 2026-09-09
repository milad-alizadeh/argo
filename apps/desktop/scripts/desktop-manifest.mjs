#!/usr/bin/env node
// `bun run desktop:manifest [<path to Argo.app>] [--write]` — the two callers of
// `package-manifest.mjs`. Without `--write` it compares the package against the checked-in
// manifest; with it, it regenerates that file.
//
// Regeneration is by hand and reviewed as a diff. Nothing regenerates it on merge: a gate that
// agrees with whatever shipped is the shape of a gate that never fires
// ([#1788](https://github.com/milad-alizadeh/argo/issues/1788)).
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  MANIFEST_PATH,
  packageManifestAssertion,
  readPackagedManifest,
} from './package-manifest.mjs'

// #1745 ships arm64 alone, and Forge names the output directory, so the one path worth defaulting
// to is the one every local package writes.
const DEFAULT_APP = path.resolve(import.meta.dirname, '..', 'out', 'Argo-darwin-arm64', 'Argo.app')

function reportDifferences(assertion) {
  process.stderr.write(
    [
      `${assertion.appPath} does not match ${path.basename(MANIFEST_PATH)}:`,
      ...assertion.differences.map((difference) => `  ${difference}`),
      '',
      '`+` is in the package and not in the manifest; `-` is in the manifest and not in the',
      'package. Both fail. If the new shape is the one to ship, regenerate with',
      '`bun run desktop:manifest --write` and review the diff.',
      '',
    ].join('\n'),
  )
}

const args = process.argv.slice(2)
const write = args.includes('--write')
const appPath = args.find((argument) => !argument.startsWith('--')) ?? DEFAULT_APP

if (write) {
  const manifest = readPackagedManifest(appPath)
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`wrote ${MANIFEST_PATH} from ${appPath}\n`)
  process.exit(0)
}

// The assertion goes to stdout whether it passed or failed, because it is one entry in the
// release verdict rather than a standalone pass or fail (#1788), and a verdict that records what
// it could not assert is worth more than a silence.
const assertion = packageManifestAssertion(appPath)
process.stdout.write(`${JSON.stringify(assertion)}\n`)
if (!assertion.passed) reportDifferences(assertion)
process.exit(assertion.passed ? 0 : 1)
