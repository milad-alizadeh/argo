// The Session journeys alone, against one CLI backend (#2308). feed.e2e.ts runs this
// same case set after its fourteen fixture cases; this file registers nothing else, so a backend
// driving a CLI that writes no fixture transcripts has an entry point of its own.
import { createMockSessionCliBackend } from '../../mocks/sessions/mock-session-cli-backend'
import { defineSessionJourneyCases } from './cases/journeys.case'
import { createPageBox, defineLaunchWithProject, describeSessionProof } from './session-proof-run'

const backend = createMockSessionCliBackend()

describeSessionProof('session-journeys', backend, (run) => {
  const box = createPageBox(run.hold)
  defineLaunchWithProject(run, box)

  defineSessionJourneyCases({ backend, fixture: () => run.fixture, restart: run.restart, box })
})
