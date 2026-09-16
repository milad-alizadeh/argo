// The scaffolding every packaged Session entry point shares (#2308): a fixture root that is
// removed however the run ends, a harness on one CLI backend, the case runner, and the one JSON
// line the run prints. An entry point is then its case list and nothing else.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Page } from 'playwright-core'
import { type CaseResults, createCaseRunner } from './packaged-case-runner'
import { createPackagedSessionHarness } from './packaged-session-harness'
import type { SessionCliBackend } from './session-cli-backend'

type Harness = Awaited<ReturnType<typeof createPackagedSessionHarness>>

export type PackagedSessionRun = Harness & {
  root: string
  ran: ReturnType<typeof createCaseRunner>
  // Records the page the cases are now driving, so a failure reports that window's console and
  // feed rather than the one the run opened with.
  hold: (page: Page) => Page
}

export async function runPackagedSessionProof(request: {
  name: string
  backend: SessionCliBackend
  prove: (run: PackagedSessionRun) => Promise<Record<string, unknown>>
}) {
  const { backend, name, prove } = request
  const root = await mkdtemp(path.join(os.tmpdir(), `argo-${name}-`))
  const results: CaseResults = { cases: [], timings: {} }
  const started = performance.now()
  let harness: Harness | undefined
  let page: Page | undefined
  try {
    harness = await createPackagedSessionHarness(root, backend)
    const reading = await prove({
      ...harness,
      root,
      hold: (next) => {
        page = next
        return next
      },
      ran: createCaseRunner(
        results,
        () => page,
        () => harness,
      ),
    })
    const timings = {
      total: Math.round(performance.now() - started),
      launches: harness.launches(),
      cases: results.timings,
    }
    const { cases } = results
    console.log(
      JSON.stringify({
        ok: true,
        packaged: true,
        backend: backend.name,
        cases,
        ...reading,
        timings,
      }),
    )
  } finally {
    try {
      await harness?.close()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
}
