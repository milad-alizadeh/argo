import { feedStateSnapshot } from './feed-selectors'

// Runs a packaged proof case, recording its name once it passes. A failing case prints the
// feed's virtual/DOM state and the renderer's recent console output first, so a packaged failure
// names the current Session and row count instead of sending a reader to re-run the harness
// headed (#2201).
export function createCaseRunner(
  cases: string[],
  getPage: () => unknown,
  getHarness: () => { recentConsole: () => string[] } | undefined,
) {
  return async function ran<T>(names: string[], prove: () => Promise<T>): Promise<T> {
    try {
      const reading = await prove()
      cases.push(...names)
      return reading
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
