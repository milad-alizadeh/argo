#!/usr/bin/env node
// `bun run desktop:verdict --version 1.2.0 --acceptance <file> --out <file> <artifact>...` — writes
// one `release-verdict.json` for a build (ADR-0036). The release workflow runs it after the app is
// packaged, signed, notarized and made, and publishes only when the document says `passed`.
//
// It exits non-zero on a failing verdict and writes the document either way. A failure that leaves
// no verdict behind is the silence this whole design exists to close.
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { APP_NAME, appBinary, packagedApp } from './packaged-app.mts'
import { buildVerdict, VERDICT_FILENAME } from './release-verdict.mts'
import { readSigningStatus } from './signing-readback.mts'

const USAGE = `write-release-verdict.mts --version <x.y.z> [--arch arm64] [--acceptance <file>] [--out <file>] <artifact>...`

/** The flags this command takes, and the artifacts named after them. */
type Named = { arch: string; acceptance: string | null; out: string | null; version: string | null }

function parseArgs(argv: string[]): Named & { artifacts: string[] } {
  const artifacts: string[] = []
  const named: Named = { arch: 'arm64', acceptance: null, out: null, version: null }
  for (let i = 0; i < argv.length; i += 1) {
    const argument = argv[i] ?? ''
    const flag = argument.startsWith('--') ? argument.slice(2) : null
    if (flag === null) {
      artifacts.push(argument)
      continue
    }
    if (!(flag in named)) throw new Error(`unrecognised argument ${argument}. Usage: ${USAGE}`)
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--'))
      throw new Error(`--${flag} needs a value. Usage: ${USAGE}`)
    named[flag as keyof Named] = value
    i += 1
  }
  if (!named.version) throw new Error(`--version is required. Usage: ${USAGE}`)
  if (artifacts.length === 0) throw new Error(`name at least one artifact. Usage: ${USAGE}`)
  return { ...named, artifacts }
}

const { version, arch, acceptance, out, artifacts } = parseArgs(process.argv.slice(2))
const appPath = packagedApp(arch)
const outPath = out ?? path.resolve(import.meta.dirname, '..', 'out', VERDICT_FILENAME)

const verdict = await buildVerdict({
  version: version ?? '',
  tag: `v${version}`,
  appName: APP_NAME,
  appPath,
  binaryPath: appBinary(arch),
  artifactPaths: artifacts,
  acceptancePath:
    acceptance ?? path.resolve(import.meta.dirname, '..', 'out', 'packaged-pty-acceptance.json'),
  signing: readSigningStatus(appPath),
  run: {
    repository: process.env.GITHUB_REPOSITORY ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    commit: process.env.GITHUB_SHA ?? null,
    workflowRef: process.env.GITHUB_WORKFLOW_REF ?? null,
  },
})

writeFileSync(outPath, `${JSON.stringify(verdict, null, 2)}\n`)
process.stdout.write(`wrote ${outPath}\n`)
for (const failure of verdict.failures) process.stderr.write(`  - ${failure}\n`)
process.exit(verdict.passed ? 0 : 1)
