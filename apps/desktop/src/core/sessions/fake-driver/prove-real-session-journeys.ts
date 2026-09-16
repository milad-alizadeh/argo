// The portable Session journeys against subscription-authenticated CLIs; fixture cases stay fake-only.
import assert from 'node:assert/strict'
import { runPackagedSessionProof } from './packaged-session-run'
import { createRealSessionCliBackend } from './real-session-cli-backend'
import { proveSessionCreatedByClick } from './session-create-case'
import { selectProofProject } from './session-feed-fixture'
import { proveDuplicateSend, proveReplyWait } from './session-reply-delay-case'

const backend = createRealSessionCliBackend()

await runPackagedSessionProof({
  name: 'real-session-journeys',
  backend,
  prove: async ({ fixture, hold, isPackaged, launch, ran }) => {
    await selectProofProject(fixture.userData, fixture.project)
    const page = hold(await launch())
    assert.equal(await isPackaged(), true)
    await ran(['real-claude-session-created-by-click'], () =>
      proveSessionCreatedByClick(page, backend, 'claude'),
    )
    await ran(['real-codex-session-created-by-click'], () =>
      proveSessionCreatedByClick(page, backend, 'codex'),
    )
    await ran(['real-session-reply-wait'], () => proveReplyWait(page, backend))
    await ran(['real-session-duplicate-send'], () => proveDuplicateSend(page, backend))
    return {}
  },
})
