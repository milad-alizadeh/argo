// The Session journeys alone, against one CLI backend (#2308). session-feed.spec.ts runs this
// same case set after its fourteen fixture cases; this file registers nothing else, so a backend
// driving a CLI that writes no fixture transcripts has an entry point of its own.
import { expect, test } from '@playwright/test'
import { createFakeSessionCliBackend } from './fake-session-cli-backend'
import { selectProofProject } from './session-feed-fixture'
import { defineSessionJourneyCases } from './session-journey-cases'
import { createPageBox, describeSessionProof } from './session-proof-run'

const backend = createFakeSessionCliBackend()

describeSessionProof('session-journeys', backend, (run) => {
  // `fixture` stays on `run` rather than destructured here, the way session-feed.spec.ts does: this
  // callback runs at describe-registration time, before `beforeAll` assigns the harness the getter
  // reads (`session-proof-run.ts`).
  const { hold, isPackaged, launch, restart } = run
  const box = createPageBox(hold)

  test('launch', async () => {
    // Every journey starts a Session, which needs a selected Project (#2204).
    await selectProofProject(run.fixture.userData, run.fixture.project)
    box.set(await launch())
    expect(await isPackaged()).toBe(true)
  })

  defineSessionJourneyCases({ backend, fixture: () => run.fixture, restart, box })
})
