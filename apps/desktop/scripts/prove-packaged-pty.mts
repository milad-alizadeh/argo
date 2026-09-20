#!/usr/bin/env node
// The artifact tier of [#1769](https://github.com/milad-alizadeh/argo/issues/1769):
//
//   A PACKAGED macOS arm64 app loads node-pty and passes the whole #1749 acceptance boundary —
//   start, input, output, resize, interrupt, exactly-once exit, crash cleanup, app shutdown, and
//   600 spawn/exit cycles at a flat descriptor count.
//
// A working dev server is not that proof, so nothing here runs `forge start`. It runs the real
// binary inside the .app that `build` packaged, and reads the JSON line the main process writes
// plus the process exit code.
//
// Usage: node scripts/prove-packaged-pty.mts [--arch arm64] [--skip-endurance] [--json <file>]
import { existsSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { ACCEPTANCE_ENV, SKIP_ENDURANCE_ENV } from './acceptance-protocol.mts'
import type { AcceptanceResult } from './packaged-app.mts'
import {
  appBinary,
  exitFailures,
  LAUNCH_TIMEOUT_MS,
  packagedApp,
  readResult,
  resultFailures,
  run,
  SHIPPED_ARCHES,
} from './packaged-app.mts'

// A flag with no value is an error, not a shrug: a bare `--arch` used to fall through to the
// default and print `PASS arm64`, exit 0, for a run the operator believed asked for something else.
function valueAfter(argv: string[], i: number, hint: string): string {
  const value = argv[i + 1]
  if (!value || value.startsWith('--')) throw new Error(hint)
  return value
}

// An unrecognised flag is an error for the same reason, `--arch=x64` included.
function parseArgs(argv: string[]): {
  skipEndurance: boolean
  json: string | null
  arches: string[]
} {
  const arches: string[] = []
  const parsed: { skipEndurance: boolean; json: string | null } = {
    skipEndurance: false,
    json: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--skip-endurance') parsed.skipEndurance = true
    else if (flag === '--arch') {
      arches.push(
        ...valueAfter(argv, i, '--arch needs a value, like --arch arm64')
          .split(',')
          .filter(Boolean),
      )
      i += 1
    } else if (flag === '--json') {
      parsed.json = valueAfter(argv, i, '--json needs a path, like --json out/acceptance.json')
      i += 1
    } else throw new Error(`unrecognised argument ${flag}. Usage: ${USAGE}`)
  }
  return { ...parsed, arches: arches.length > 0 ? arches : SHIPPED_ARCHES }
}

const USAGE = 'prove-packaged-pty.mts [--arch arm64] [--skip-endurance] [--json <file>]'

/** What proving one architecture produced. */
type Outcome = {
  arch: string
  ok: boolean
  stage: string
  failures: string[]
  result?: AcceptanceResult | null
  stderr?: string | undefined
}

async function proveArch(
  arch: string,
  { skipEndurance }: { skipEndurance: boolean },
): Promise<Outcome> {
  const binary = appBinary(arch)
  if (!existsSync(binary)) {
    return { arch, ok: false, stage: 'package', failures: [`no packaged binary at ${binary}`] }
  }

  const launched = await run(binary, [], {
    timeoutMs: LAUNCH_TIMEOUT_MS,
    env: {
      [ACCEPTANCE_ENV]: '1',
      // Set either way, so an ambient value cannot decide this for us.
      [SKIP_ENDURANCE_ENV]: skipEndurance ? '1' : '0',
    },
  })
  const result = readResult(launched.stdout)
  const failures = [...exitFailures(launched), ...resultFailures(result, arch, { skipEndurance })]

  return {
    arch,
    ok: failures.length === 0,
    stage: 'launch',
    failures,
    result,
    stderr: failures.length > 0 ? launched.stderr.slice(-4000) : undefined,
  }
}

const { arches, skipEndurance, json } = parseArgs(process.argv.slice(2))
const outcomes: Outcome[] = []
for (const arch of arches) {
  process.stdout.write(`\n=== proving ${arch} ===\n`)
  const outcome = await proveArch(arch, { skipEndurance })
  outcomes.push(outcome)
  process.stdout.write(`${outcome.ok ? 'PASS' : 'FAIL'} ${arch}\n`)
  if (outcome.ok) process.stdout.write(`Artifact: ${packagedApp(arch)}\n`)
  if (outcome.result) process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`)
  for (const failure of outcome.failures) process.stdout.write(`  - ${failure}\n`)
  if (outcome.stderr) process.stdout.write(`--- stderr tail ---\n${outcome.stderr}\n`)
}

// Written whether the run passed or failed: the release verdict reads this file, and a failing
// acceptance run has to reach the verdict as a failing assertion rather than as a missing one.
if (json) writeFileSync(json, `${JSON.stringify(outcomes, null, 2)}\n`)

const proved = outcomes.filter((outcome) => outcome.ok).length
process.stdout.write(`\n${proved}/${outcomes.length} architectures proved\n`)
process.exit(proved === outcomes.length ? 0 : 1)
