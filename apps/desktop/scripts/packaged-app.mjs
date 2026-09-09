// Locating, running and judging a PACKAGED Argo app. The driver that uses this is
// prove-packaged-pty.mjs; the boundary it asserts is #1749, run against node-pty by #1769.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { CYCLES, RESULT_PREFIX } from './acceptance-protocol.mjs'

export { RESULT_PREFIX }
// The endurance check is 600 spawn/exit cycles, so the launch budget is minutes, not seconds.
export const LAUNCH_TIMEOUT_MS = 10 * 60_000
export const PACKAGE_TIMEOUT_MS = 15 * 60_000

export const APP_NAME = 'Argo'
// One arm64 download for Apple silicon, and no Intel or universal build
// ([#1745](https://github.com/milad-alizadeh/argo/issues/1745)). Proving an architecture nobody
// downloads costs a second full package per run and answers nothing.
export const SHIPPED_ARCHES = ['arm64']

export const desktopRoot = path.resolve(import.meta.dirname, '..')

export function run(command, args, { timeoutMs, env }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: desktopRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    // A spawn that never starts emits 'error' and no 'close', so without this the promise would
    // hang until the timeout and report a missing binary as a slow app.
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: null, signal: null, stdout, stderr: `${stderr}${error.message}\n`, timedOut })
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, stdout, stderr, timedOut })
    })
  })
}

// Never `npx electron-forge`: npx resolves the bare name against the registry and installs
// electron-forge@5.2.4 from 2018, which then dies asking for electron-prebuilt-compile. The CLI
// this app pins is @electron-forge/cli, and this is its binary. Bun's linker decides whether this
// package or the workspace root holds node_modules, so look in both rather than assume a layout.
export function forgeBinary() {
  const candidates = [
    path.join(desktopRoot, 'node_modules', '.bin', 'electron-forge'),
    path.join(desktopRoot, '..', '..', 'node_modules', '.bin', 'electron-forge'),
  ]
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found)
    throw new Error(`no electron-forge binary found. Looked in:\n  ${candidates.join('\n  ')}`)
  return found
}

// Forge names the output directory out/<app>-darwin-<arch>.
function outputDirectory(arch) {
  return path.join(desktopRoot, 'out', `${APP_NAME}-darwin-${arch}`)
}

export function packagedApp(arch) {
  return path.join(outputDirectory(arch), `${APP_NAME}.app`)
}

export function appBinary(arch) {
  return path.join(packagedApp(arch), 'Contents', 'MacOS', APP_NAME)
}

export function readResult(stdout) {
  const line = stdout.split('\n').find((candidate) => candidate.startsWith(RESULT_PREFIX))
  if (!line) return null
  try {
    return JSON.parse(line.slice(RESULT_PREFIX.length))
  } catch {
    return null
  }
}

// A clean exit is code 0, no killing signal, and not our own timeout. The app quitting on its own
// after the cases is itself the app-shutdown case: a hang here is a failure, not a slow machine.
export function exitFailures(launched) {
  const failures = []
  if (launched.timedOut) failures.push(`the app did not exit within ${LAUNCH_TIMEOUT_MS}ms`)
  if (launched.code !== 0) failures.push(`exit code was ${launched.code}, expected 0`)
  if (launched.signal) failures.push(`the app died on signal ${launched.signal}`)
  return failures
}

// The endurance check reads an env var, and the app inherits this process's whole environment, so
// an `ARGO_PTY_SKIP_ENDURANCE=1` left in a shell or set on a runner would drop the one check that
// caught node-pty 1.1.0's leak — and the run would still print PASS. The driver knows whether it
// asked to skip; anything else is a failure, including a run that quietly did fewer cycles.
function enduranceFailures(endurance, skipEndurance) {
  if (skipEndurance) return []
  if (endurance === 'skipped')
    return [`the endurance check was skipped, but this run did not ask to skip it`]
  if (typeof endurance !== 'object' || endurance === null) return [`endurance: ${endurance}`]
  if (endurance.cycles !== CYCLES)
    return [`endurance ran ${endurance.cycles} cycles, expected ${CYCLES}`]
  return []
}

// The app has to prove it was the packaged one, built for the architecture asked for, and that
// every case of the acceptance boundary passed inside it.
export function resultFailures(result, arch, { skipEndurance = false } = {}) {
  if (!result)
    return [`the app printed no ${RESULT_PREFIX.trim()} line; node-pty may have failed to load`]
  const failures = []
  for (const [name, outcome] of Object.entries(result.cases ?? {}))
    if (outcome !== 'pass') failures.push(`case ${name}: ${outcome}`)
  failures.push(...enduranceFailures(result.endurance, skipEndurance))
  if (result.packaged !== true)
    failures.push('app.isPackaged was false, so this was not the packaged app')
  if (result.processArch !== arch)
    failures.push(`process.arch was ${result.processArch}, expected ${arch}`)
  return failures
}
