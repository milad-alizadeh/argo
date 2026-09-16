import {
  type CaseResults,
  createCaseRunner as createSharedCaseRunner,
  type Ran,
} from '../../desktop-proof/packaged-case-runner'
import { feedStateSnapshot } from './feed-selectors'

export type { CaseResults }

// The Session proof's case runner, built on the shared one: the same pass/fail bookkeeping, plus
// a failing case's feed snapshot and recent console output printed first, so a packaged failure
// names the current Session and row count instead of sending a reader to re-run the harness
// headed (#2201).
export function createCaseRunner(
  results: CaseResults,
  getPage: () => unknown,
  getHarness: () => { recentConsole: () => string[] } | undefined,
): Ran {
  const ran = createSharedCaseRunner(results)
  return async <T>(names: string[], prove: () => Promise<T>): Promise<T> => {
    try {
      return await ran(names, prove)
    } catch (error) {
      const snapshot = await feedStateSnapshot(getPage()).catch((snapshotError: unknown) => ({
        snapshotFailed: String(snapshotError),
      }))
      console.error(
        JSON.stringify({
          failedCase: names,
          feedState: snapshot,
          recentConsole: getHarness()?.recentConsole(),
        }),
      )
      throw error
    }
  }
}
