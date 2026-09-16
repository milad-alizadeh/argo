// The Session journeys alone, against one CLI backend (#2308). feed.e2e.ts runs this
// same case set after its fourteen fixture cases; this file registers nothing else, so a backend
// driving a CLI that writes no fixture transcripts has an entry point of its own.
import { expect, test } from '@playwright/test'
import { createMockSessionCliBackend } from '../../mocks/sessions/mock-session-cli-backend'
import { defineSessionJourneyCases } from './cases/journeys.case'
import { selectProofProject } from './fixtures/feed.fixture'
import { createPageBox, describeSessionProof } from './session-proof-run'

const backend = createMockSessionCliBackend()

describeSessionProof('session-journeys', backend, (run) => {
  // `fixture` stays on `run` rather than destructured here, the way feed.e2e.ts does: this
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
