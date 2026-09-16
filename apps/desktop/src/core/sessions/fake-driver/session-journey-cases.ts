// The eight Session journeys: a person starts a Session, sends a Turn, restarts the app, resumes
// and renames. Every one of them runs after the proof selects a Project, and every one asks the
// backend what a reply looks like, so more than one entry point can run the set (#2308).
import { proveClaudeRename } from '../../../agents/claude/session-fake-driver/session-rename-case'
import { provePackagedResume } from '../../../agents/claude/session-fake-driver/session-resume-case'
import { provePackagedCodexResume } from '../../../agents/codex/session-fake-driver/codex-resume-case'
import { proveCodexThreadName } from '../../../agents/codex/session-fake-driver/codex-thread-name-case'
import type { createCaseRunner } from './packaged-case-runner'
import type { createPackagedSessionHarness } from './packaged-session-harness'
import type { SessionCliBackend, SessionFixture } from './session-cli-backend'
import { proveSessionCreatedByClick } from './session-create-case'
import { proveDuplicateSend, proveReplyWait } from './session-reply-delay-case'
import { proveComposerMemory } from './session-turn-setup-cases'

type Harness = Awaited<ReturnType<typeof createPackagedSessionHarness>>
type Page = Awaited<ReturnType<Harness['launch']>>

export type SessionJourneyRequest = {
  page: Page
  ran: ReturnType<typeof createCaseRunner>
  backend: SessionCliBackend
  fixture: SessionFixture
  restart: Harness['restart']
}

async function proveResumeAndRename(request: SessionJourneyRequest) {
  let { page } = request
  const { backend, fixture, ran, restart } = request
  await ran(['session-composer-memory'], () => proveComposerMemory(page))
  // Before the resume cases, for the reason session-create-case.ts records.
  await ran(['session-created-by-click'], () => proveSessionCreatedByClick(page, backend))
  await ran(['session-claude-resume'], async () => {
    page = await provePackagedResume(page, {
      backend,
      project: fixture.project,
      restart,
      transcripts: fixture.claudeTranscripts,
    })
  })
  await ran(['session-codex-resume'], async () => {
    page = await provePackagedCodexResume(page, { backend, restart })
  })
  await ran(['session-claude-rename'], () =>
    proveClaudeRename(page, {
      backend,
      project: fixture.project,
      transcripts: fixture.claudeTranscripts,
    }),
  )
}

export async function proveSessionJourneys(request: SessionJourneyRequest): Promise<Page> {
  const { backend, fixture, ran, restart } = request
  await proveResumeAndRename(request)
  // Each case below starts its own Session with its own prompt, so the fixture root carries over.
  // A slow CLI, so the two wait cases can read the app holding a Turn open.
  const page = await restart({ slowReply: true })
  await ran(['session-reply-wait'], () => proveReplyWait(page, backend))
  await ran(['session-duplicate-send'], () => proveDuplicateSend(page, backend))
  // Last, because naming the Codex row changes the title the cases above open it by.
  await ran(['session-codex-thread-name'], () =>
    proveCodexThreadName(page, fixture.codexTranscripts),
  )
  return page
}
