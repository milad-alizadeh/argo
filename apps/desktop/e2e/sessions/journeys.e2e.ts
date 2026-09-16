// The Session journeys on the backend the project chose: `sessions` runs the mock, `real-sessions` the signed-in CLIs.
import { defineSessionJourneyCases } from './cases/journeys.case'
import { createPageBox, defineLaunchWithProject, describeSessionProof } from './session-proof-run'

describeSessionProof('session-journeys', (run) => {
  const box = createPageBox(run.hold)
  defineLaunchWithProject(run, box)
  defineSessionJourneyCases(run, box)
})
