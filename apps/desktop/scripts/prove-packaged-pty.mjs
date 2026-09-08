#!/usr/bin/env node
// The acceptance test for the Electron toolchain decision (#1732), demanded by #1743:
//
//   A PACKAGED macOS app, on arm64 AND x64, loads node-pty, opens a PTY, and exits cleanly.
//
// A working dev server is not that proof, so nothing here runs `forge start`. It packages each
// architecture with Forge, launches the real binary inside the .app, and asserts on the JSON line
// the main process writes plus the process exit code.
//
// Usage: node scripts/prove-packaged-pty.mjs [--arch arm64,x64] [--skip-package]
import { existsSync } from 'node:fs'
import process from 'node:process'
import {
  appBinary,
  exitFailures,
  forgeBinary,
  LAUNCH_TIMEOUT_MS,
  PACKAGE_TIMEOUT_MS,
  readResult,
  resultFailures,
  run,
} from './packaged-app.mjs'

function parseArgs(argv) {
  const arches = []
  let skipPackage = false
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--arch') arches.push(...(argv[i + 1] ?? '').split(',').filter(Boolean))
    if (argv[i] === '--skip-package') skipPackage = true
  }
  return { arches: arches.length > 0 ? arches : ['arm64', 'x64'], skipPackage }
}

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

async function proveArch(arch, { skipPackage }) {
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
    env: { ARGO_PTY_SMOKE: '1', ARGO_PTY_TOKEN: `argo-pty-${arch}-${Date.now()}` },
  })
  const result = readResult(launched.stdout)
  const failures = [...exitFailures(launched), ...resultFailures(result, arch)]

  return {
    arch,
    ok: failures.length === 0,
    stage: 'launch',
    failures,
    result,
    stderr: failures.length > 0 ? launched.stderr.slice(-4000) : undefined,
  }
}

const { arches, skipPackage } = parseArgs(process.argv.slice(2))
const outcomes = []
for (const arch of arches) {
  process.stdout.write(`\n=== proving ${arch} ===\n`)
  const outcome = await proveArch(arch, { skipPackage })
  outcomes.push(outcome)
  process.stdout.write(`${outcome.ok ? 'PASS' : 'FAIL'} ${arch}\n`)
  if (outcome.result) process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`)
  for (const failure of outcome.failures) process.stdout.write(`  - ${failure}\n`)
  if (outcome.stderr) process.stdout.write(`--- stderr tail ---\n${outcome.stderr}\n`)
}

const proved = outcomes.length - outcomes.filter((outcome) => !outcome.ok).length
process.stdout.write(`\n${proved}/${outcomes.length} architectures proved\n`)
process.exit(proved === outcomes.length ? 0 : 1)
