#!/usr/bin/env node
// The artifact tier of [#1769](https://github.com/milad-alizadeh/argo/issues/1769):
//
//   A PACKAGED macOS arm64 app loads node-pty and passes the whole #1749 acceptance boundary —
//   start, input, output, resize, interrupt, exactly-once exit, crash cleanup, app shutdown, and
//   600 spawn/exit cycles at a flat descriptor count.
//
// A working dev server is not that proof, so nothing here runs `forge start`. It packages with
// Forge — whose `postPackage` hook has already refused an app with no working PTY before this
// gets to launch anything — then runs the real binary inside the .app and reads the JSON line the
// main process writes plus the process exit code.
//
// Usage: node scripts/prove-packaged-pty.mjs [--arch arm64] [--skip-package] [--skip-endurance]
import { existsSync } from 'node:fs'
import process from 'node:process'
import { ACCEPTANCE_ENV, SKIP_ENDURANCE_ENV } from './acceptance-protocol.mjs'
import {
  appBinary,
  exitFailures,
  forgeBinary,
  LAUNCH_TIMEOUT_MS,
  PACKAGE_TIMEOUT_MS,
  readResult,
  resultFailures,
  run,
  SHIPPED_ARCHES,
} from './packaged-app.mjs'

// An unrecognised flag is an error, not a shrug. `--arch=x64` and a bare `--arch` both used to
// fall through to the default and print `PASS arm64`, exit 0, for a run the operator believed
// asked for something else.
function parseArgs(argv) {
  const arches = []
  let skipPackage = false
  let skipEndurance = false
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--arch') {
      const named = (argv[i + 1] ?? '').split(',').filter(Boolean)
      if (named.length === 0) throw new Error('--arch needs a value, like --arch arm64')
      arches.push(...named)
      i += 1
    } else if (argv[i] === '--skip-package') skipPackage = true
    else if (argv[i] === '--skip-endurance') skipEndurance = true
    else throw new Error(`unrecognised argument ${argv[i]}. Usage: ${USAGE}`)
  }
  return { arches: arches.length > 0 ? arches : SHIPPED_ARCHES, skipPackage, skipEndurance }
}

const USAGE = 'prove-packaged-pty.mjs [--arch arm64] [--skip-package] [--skip-endurance]'

async function packageArch(arch) {
  const packaged = await run(forgeBinary(), ['package', '--arch', arch], {
    timeoutMs: PACKAGE_TIMEOUT_MS,
  })
  if (packaged.code === 0) return null
  const timedOut = packaged.timedOut ? ' (timed out)' : ''
  return {
    arch,
    ok: false,
    stage: 'package',
    failures: [`forge package --arch ${arch} exited ${packaged.code}${timedOut}`],
    stderr: packaged.stderr.slice(-4000),
  }
}

async function proveArch(arch, { skipPackage, skipEndurance }) {
  if (!skipPackage) {
    const failed = await packageArch(arch)
    if (failed) return failed
  }

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

const { arches, skipPackage, skipEndurance } = parseArgs(process.argv.slice(2))
const outcomes = []
for (const arch of arches) {
  process.stdout.write(`\n=== proving ${arch} ===\n`)
  const outcome = await proveArch(arch, { skipPackage, skipEndurance })
  outcomes.push(outcome)
  process.stdout.write(`${outcome.ok ? 'PASS' : 'FAIL'} ${arch}\n`)
  if (outcome.result) process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`)
  for (const failure of outcome.failures) process.stdout.write(`  - ${failure}\n`)
  if (outcome.stderr) process.stdout.write(`--- stderr tail ---\n${outcome.stderr}\n`)
}

const proved = outcomes.filter((outcome) => outcome.ok).length
process.stdout.write(`\n${proved}/${outcomes.length} architectures proved\n`)
process.exit(proved === outcomes.length ? 0 : 1)
