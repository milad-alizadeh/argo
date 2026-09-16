// The Session journeys alone, against one CLI backend (#2308). prove-session-feed.ts runs this
// same module after its fourteen fixture cases; this entry point runs nothing else, so a backend
// driving a CLI that writes no fixture transcripts has a command of its own.
import assert from 'node:assert/strict'
import { createFakeSessionCliBackend } from './fake-session-cli-backend'
import { runPackagedSessionProof } from './packaged-session-run'
import { selectProofProject } from './session-feed-fixture'
import { proveSessionJourneys } from './session-journey-cases'
import { proveNewSessionWithNoProject } from './session-new-with-no-project-case'

const backend = createFakeSessionCliBackend()

await runPackagedSessionProof({
  name: 'session-journeys',
  backend,
  prove: async ({ fixture, hold, isPackaged, launch, ran, restart }) => {
    let page = hold(await launch())
    assert.equal(await isPackaged(), true)
    // Before any Project is selected, so this cannot pass by accident on a Project the fixture
    // already carries (#2307).
    await ran(['session-new-with-no-project'], () => proveNewSessionWithNoProject(page))
    // Every journey after this starts a Session, which needs a selected Project (#2204).
    await selectProofProject(fixture.userData, fixture.project)
    page = hold(await restart())
    hold(await proveSessionJourneys({ page, ran, backend, fixture, restart }))
    return {}
  },
})
