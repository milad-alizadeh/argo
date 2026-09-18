// Session journeys on the project's backend: `sessions` runs the mock, `real-sessions` the CLIs (#2308).
import { proveClaudeRename } from './cases/claude-rename.case'
import { provePackagedResume } from './cases/claude-resume.case'
import { provePackagedCodexResume } from './cases/codex-resume.case'
import { proveCodexThreadName } from './cases/codex-thread-name.case'
import { proveSessionCreatedByClick } from './cases/create.case'
import { provePackagedIndexRecovery } from './cases/index-recovery.case'
import { provePromptLatency } from './cases/prompt-latency.case'
import { proveDuplicateSend, proveReplyWait } from './cases/reply-delay.case'
import { proveComposerMemory } from './cases/turn-setup.case'
import { test } from './session-proof-run'

const SEEDED = 'Reads seeded transcripts or a scripted reply that only the mock backend provides.'

test('session-created-by-click', async ({ session, backend }) => {
  await proveSessionCreatedByClick(session.page(), backend)
})

// A skip that reads only the worker's backend decides before the case launches anything.
test.describe('with a real Codex', () => {
  test.skip(({ sessionBackend }) => sessionBackend === 'mock', 'session-codex-resume creates one.')

  test('session-codex-created-by-click', async ({ session, backend }) => {
    await proveSessionCreatedByClick(session.page(), backend, 'codex')
  })
})

test.describe('with seeded transcripts', () => {
  test.skip(({ sessionBackend }) => sessionBackend !== 'mock', SEEDED)

  test('session-composer-memory', async ({ session }) => {
    await proveComposerMemory(session.page())
  })

  test('session-claude-resume', async ({ session, backend }) => {
    await provePackagedResume(session.page(), {
      backend,
      project: session.fixture.project,
      restart: session.restart,
      transcripts: session.fixture.claudeTranscripts,
    })
  })

  test('session-codex-resume', async ({ session, backend }) => {
    await provePackagedCodexResume(session.page(), { backend, restart: session.restart })
  })

  test('session-claude-rename', async ({ session, backend }) => {
    await proveClaudeRename(session.page(), {
      backend,
      project: session.fixture.project,
      transcripts: session.fixture.claudeTranscripts,
    })
  })

  test('session-codex-thread-name', async ({ session }) => {
    await proveCodexThreadName(session.page(), session.fixture.codexTranscripts)
  })

  test('session-index-recovery', async ({ session }) => {
    await provePackagedIndexRecovery(session.page(), {
      restart: session.restart,
      userData: session.fixture.userData,
    })
  })
})

test.describe('with a slow CLI', () => {
  test.use({ slowReply: true })

  test('session-reply-wait', async ({ session, backend }) => {
    await proveReplyWait(session.page(), backend)
  })

  test('session-prompt-latency', async ({ session, backend }) => {
    await provePromptLatency(session.page(), backend)
  })

  test('session-duplicate-send', async ({ session, backend }) => {
    await proveDuplicateSend(session.page(), backend)
  })
})
