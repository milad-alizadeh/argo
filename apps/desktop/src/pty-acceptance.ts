// Runs the acceptance boundary inside the packaged app and prints one JSON line for the driver
// outside to read. [#1769](https://github.com/milad-alizadeh/argo/issues/1769).
//
// It writes a line rather than setting an exit code alone, because "which case failed" is the
// thing a person needs and an exit code cannot carry it. The exit code is still the gate.
import { app } from 'electron'
import { RESULT_PREFIX, SKIP_ENDURANCE_ENV } from '../scripts/acceptance-protocol.mjs'
import { BEHAVIOUR_CASES } from './pty-cases'
import { descriptorsStayFlat } from './pty-endurance'

export { RESULT_PREFIX }

// The endurance check is minutes of work on a busy machine and the behaviour cases are seconds,
// so a person debugging one case can drop it. It is never silently absent: `endurance` says which
// of the three things happened, and the driver refuses a 'skipped' it did not itself ask for.
const ENDURANCE_ENABLED = process.env[SKIP_ENDURANCE_ENV] !== '1'

export type AcceptanceResult = {
  ok: boolean
  cases: Record<string, string>
  /** The measurement, or `'skipped'`, or the reason it failed. Never a failure dressed as a skip. */
  endurance: Record<string, number> | string
  packaged: boolean
  processArch: string
  electron: string
  node: string
  resourcesPath: string
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function runAcceptance(cwd: string): Promise<AcceptanceResult> {
  const cases: Record<string, string> = {}
  for (const [name, runCase] of Object.entries(BEHAVIOUR_CASES)) {
    try {
      await runCase(cwd)
      cases[name] = 'pass'
    } catch (error) {
      cases[name] = messageOf(error)
    }
  }

  let endurance: Record<string, number> | string = 'skipped'
  if (ENDURANCE_ENABLED) {
    try {
      endurance = await descriptorsStayFlat(cwd)
    } catch (error) {
      cases.endurance = messageOf(error)
      endurance = messageOf(error)
    }
  }

  return {
    ok: Object.values(cases).every((outcome) => outcome === 'pass'),
    cases,
    endurance,
    packaged: app.isPackaged,
    processArch: process.arch,
    electron: process.versions.electron,
    node: process.versions.node,
    resourcesPath: process.resourcesPath,
  }
}

// Awaits the flush. stdout is a pipe here, so the write is asynchronous and `app.exit(1)` does not
// drain it — the failing run would still go red, but the per-case reason, which is the only thing
// this line exists to carry, can be lost exactly when it is needed.
export function reportAcceptance(result: AcceptanceResult): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(result)}\n`, () => resolve())
  })
}
