// The composer-memory, create, resume and rename cases all run against the same
// Project-selected fixture in sequence.
import { proveClaudeRename } from '../../../agents/claude/session-fake-driver/session-rename-case'
import { provePackagedResume } from '../../../agents/claude/session-fake-driver/session-resume-case'
import { provePackagedCodexResume } from '../../../agents/codex/session-fake-driver/codex-resume-case'
import type { createCaseRunner } from './packaged-case-runner'
import type { createPackagedSessionHarness } from './packaged-session-harness'
import { proveSessionCreatedByClick } from './session-create-case'
import { proveComposerMemory } from './session-turn-setup-cases'

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof createPackagedSessionHarness>>['launch']>>
type Restart = Awaited<ReturnType<typeof createPackagedSessionHarness>>['restart']

export async function proveResumeAndRenameFlow(options: {
  page: Page
  ran: ReturnType<typeof createCaseRunner>
  fixture: { project: string; claudeTranscripts: string }
  restart: Restart
}): Promise<Page> {
  let { page } = options
  const { ran, fixture, restart } = options
  await ran(['session-composer-memory'], () =>
    proveComposerMemory(page, fixture.claudeTranscripts, fixture.project),
  )
  // Before the resume cases, for the reason session-create-case.ts records.
  await ran(['session-created-by-click'], () =>
    proveSessionCreatedByClick(page, fixture.claudeTranscripts),
  )
  await ran(['session-claude-resume'], async () => {
    page = await provePackagedResume(page, {
      project: fixture.project,
      restart,
      transcripts: fixture.claudeTranscripts,
    })
  })
  await ran(['session-codex-resume'], async () => {
    page = await provePackagedCodexResume(page, { restart })
  })
  await ran(['session-claude-rename'], () =>
    proveClaudeRename(page, { project: fixture.project, transcripts: fixture.claudeTranscripts }),
  )
  return page
}
