// Locating, running and judging a PACKAGED Argo app. The driver that uses this is
// prove-packaged-pty.mts; the boundary it asserts is #1749, run against node-pty by #1769.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { CYCLES, RESULT_PREFIX } from './acceptance-protocol.mts'

export { RESULT_PREFIX }
// The endurance check is 600 spawn/exit cycles, but each cycle already bounds itself to 15s
// (`CYCLE_TIMEOUT_MS` in pty-endurance.ts) and throws instead of hanging, so a genuinely broken
// app fails within seconds, not minutes. A green run takes well under a minute (#2605); this stays
// a multiple of that, not the ten-minute budget that let one bad launch run the whole CI job out.
export const LAUNCH_TIMEOUT_MS = 2 * 60_000

export const APP_NAME = 'Argo'
// One arm64 download for Apple silicon, and no Intel or universal build
// ([#1745](https://github.com/milad-alizadeh/argo/issues/1745)). Proving an architecture nobody
// downloads costs a second full package per run and answers nothing.
export const SHIPPED_ARCHES: string[] = ['arm64']

/** What one run of the packaged app left behind. */
export type Launched = {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  timedOut: boolean
}

/** The JSON line the app prints once its acceptance cases have run. */
export type AcceptanceResult = {
  cases?: Record<string, string>
  endurance?: 'skipped' | { cycles?: number } | null
  packaged?: boolean
  processArch?: string
}

export const desktopRoot = path.resolve(import.meta.dirname, '..')

export function run(
  command: string,
  args: string[],
  { timeoutMs, env }: { timeoutMs: number; env?: Record<string, string> },
): Promise<Launched> {
  return new Promise<Launched>((resolve) => {
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

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: Buffer) => {
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

// The Electron binary this app pins, for a driver that needs a browser rather than the packaged
// app. Bun's linker decides whether this package or the workspace root holds it, so probe both.
export function electronBinary(): string {
  const candidates = [
    path.join(desktopRoot, 'node_modules', 'electron', 'dist', 'Electron.app'),
    path.join(desktopRoot, '..', '..', 'node_modules', 'electron', 'dist', 'Electron.app'),
  ].map((bundle) => path.join(bundle, 'Contents', 'MacOS', 'Electron'))
  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found)
    throw new Error(
      `no Electron binary found. Run \`bun run install:electron\` from the repository root. ` +
        `Looked in:\n  ${candidates.join('\n  ')}`,
    )
  return found
}

// Forge names the output directory out/<app>-darwin-<arch>.
function outputDirectory(arch: string): string {
  return path.join(desktopRoot, 'out', `${APP_NAME}-darwin-${arch}`)
}

export function packagedApp(arch: string): string {
  return path.join(outputDirectory(arch), `${APP_NAME}.app`)
}

export function appBinary(arch: string): string {
  return path.join(packagedApp(arch), 'Contents', 'MacOS', APP_NAME)
}

export function readResult(stdout: string): AcceptanceResult | null {
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
export function exitFailures(launched: Launched): string[] {
  const failures: string[] = []
  if (launched.timedOut) failures.push(`the app did not exit within ${LAUNCH_TIMEOUT_MS}ms`)
  if (launched.code !== 0) failures.push(`exit code was ${launched.code}, expected 0`)
  if (launched.signal) failures.push(`the app died on signal ${launched.signal}`)
  return failures
}

// The endurance check reads an env var, and the app inherits this process's whole environment, so
// an `ARGO_PTY_SKIP_ENDURANCE=1` left in a shell or set on a runner would drop the one check that
// caught node-pty 1.1.0's leak — and the run would still print PASS. The driver knows whether it
// asked to skip; anything else is a failure, including a run that quietly did fewer cycles.
function enduranceFailures(
  endurance: AcceptanceResult['endurance'],
  skipEndurance: boolean,
): string[] {
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
export function resultFailures(
  result: AcceptanceResult | null,
  arch: string,
  { skipEndurance = false }: { skipEndurance?: boolean } = {},
): string[] {
  if (!result)
    return [`the app printed no ${RESULT_PREFIX.trim()} line; node-pty may have failed to load`]
  const failures: string[] = []
  for (const [name, outcome] of Object.entries(result.cases ?? {}))
    if (outcome !== 'pass') failures.push(`case ${name}: ${outcome}`)
  failures.push(...enduranceFailures(result.endurance, skipEndurance))
  if (result.packaged !== true)
    failures.push('app.isPackaged was false, so this was not the packaged app')
  if (result.processArch !== arch)
    failures.push(`process.arch was ${result.processArch}, expected ${arch}`)
  return failures
}
