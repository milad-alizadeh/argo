// The Session journeys alone, against one CLI backend (#2308). prove-session-feed.ts runs this
// same module after its fourteen fixture cases; this entry point runs nothing else, so a backend
// driving a CLI that writes no fixture transcripts has a command of its own.
import assert from 'node:assert/strict'
import { createFakeSessionCliBackend } from './fake-session-cli-backend'
import { runPackagedSessionProof } from './packaged-session-run'
import { selectProofProject } from './session-feed-fixture'
import { proveSessionJourneys } from './session-journey-cases'

const backend = createFakeSessionCliBackend()

await runPackagedSessionProof({
  name: 'session-journeys',
  backend,
  prove: async ({ fixture, hold, isPackaged, launch, ran, restart }) => {
    // Every journey starts a Session, which needs a selected Project (#2204).
    await selectProofProject(fixture.userData, fixture.project)
    const page = hold(await launch())
    assert.equal(await isPackaged(), true)
    hold(await proveSessionJourneys({ page, ran, backend, fixture, restart }))
    return {}
  },
})
