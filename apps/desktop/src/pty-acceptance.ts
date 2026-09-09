// Runs the acceptance boundary inside the packaged app and prints one JSON line for the driver
// outside to read. [#1769](https://github.com/milad-alizadeh/argo/issues/1769).
//
// It writes a line rather than setting an exit code alone, because "which case failed" is the
// thing a person needs and an exit code cannot carry it. The exit code is still the gate.
import { app } from 'electron'
import { BEHAVIOUR_CASES } from './pty-cases'
import { descriptorsStayFlat } from './pty-endurance'

export const RESULT_PREFIX = 'ARGO_PTY_ACCEPTANCE '
// The endurance check is minutes of work on a busy machine and the behaviour cases are seconds,
// so it is opt-out: every packaged build runs it, and a person debugging one case need not.
const ENDURANCE_ENABLED = process.env.ARGO_PTY_SKIP_ENDURANCE !== '1'

export type AcceptanceResult = {
  ok: boolean
  cases: Record<string, string>
  endurance: Record<string, number> | 'skipped'
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

  let endurance: Record<string, number> | 'skipped' = 'skipped'
  if (ENDURANCE_ENABLED) {
    try {
      endurance = await descriptorsStayFlat(cwd)
    } catch (error) {
      cases.endurance = messageOf(error)
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

export function reportAcceptance(result: AcceptanceResult): void {
  process.stdout.write(`${RESULT_PREFIX}${JSON.stringify(result)}\n`)
}
