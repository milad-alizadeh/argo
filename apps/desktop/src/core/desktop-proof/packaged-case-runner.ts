// Runs a packaged proof case, recording its name once it passes and its wall time in
// milliseconds either way. A case that throws is left out of the passed list, so a proof's
// printed cases can never drift from the calls its own body made (#2319).
export type CaseResults = { cases: string[]; timings: Record<string, number> }

export type Ran = <T>(names: string[], prove: () => Promise<T>) => Promise<T>

export function createCaseRunner(results: CaseResults): Ran {
  return async function ran<T>(names: string[], prove: () => Promise<T>): Promise<T> {
    const started = performance.now()
    try {
      const reading = await prove()
      results.cases.push(...names)
      return reading
    } finally {
      results.timings[names.join(',')] = Math.round(performance.now() - started)
    }
  }
}

// The one line every packaged proof prints on success, naming only the cases its own runner
// recorded.
export function printPackagedProofResult(cases: string[]) {
  console.log(
    JSON.stringify({
      ok: true,
      packaged: true,
      signed: false,
      profile: 'test',
      cases,
    }),
  )
}
