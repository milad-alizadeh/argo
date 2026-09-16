// The eight Session journeys: a person starts a Session, sends a Turn, restarts the app, resumes
// and renames. Every one of them runs after the proof selects a Project, and every one asks the
// backend what a reply looks like, so more than one spec file can register the set (#2308, #2325).
import { test } from '@playwright/test'
import { proveClaudeRename } from '../../../agents/claude/session-fake-driver/session-rename-case'
import { provePackagedResume } from '../../../agents/claude/session-fake-driver/session-resume-case'
import { provePackagedCodexResume } from '../../../agents/codex/session-fake-driver/codex-resume-case'
import { proveCodexThreadName } from '../../../agents/codex/session-fake-driver/codex-thread-name-case'
import type { SessionCliBackend, SessionFixture } from './session-cli-backend'
import { proveSessionCreatedByClick } from './session-create-case'
import type { PageBox, SessionProofRun } from './session-proof-run'
import { proveDuplicateSend, proveReplyWait } from './session-reply-delay-case'
import { proveComposerMemory } from './session-turn-setup-cases'

export type SessionJourneyRequest = {
  backend: SessionCliBackend
  // A thunk, not the fixture itself: a caller registering these cases at describe-registration
  // time has no fixture yet (`session-proof-run.ts`), so each case below reads it inside its own
  // test body instead, once `beforeAll` has run.
  fixture: () => SessionFixture
  restart: SessionProofRun['restart']
  box: PageBox
}

export function defineSessionJourneyCases(request: SessionJourneyRequest) {
  const { backend, fixture, restart, box } = request

  test('session-composer-memory', async () => {
    await proveComposerMemory(box.get(), fixture().claudeTranscripts, fixture().project)
  })

  // Before the resume cases, for the reason session-create-case.ts records.
  test('session-created-by-click', async () => {
    await proveSessionCreatedByClick(box.get(), backend, fixture().claudeTranscripts)
  })

  test('session-claude-resume', async () => {
    box.set(
      await provePackagedResume(box.get(), {
        backend,
        project: fixture().project,
        restart,
        transcripts: fixture().claudeTranscripts,
      }),
    )
  })

  test('session-codex-resume', async () => {
    box.set(await provePackagedCodexResume(box.get(), { backend, restart }))
  })

  test('session-claude-rename', async () => {
    await proveClaudeRename(box.get(), {
      backend,
      project: fixture().project,
      transcripts: fixture().claudeTranscripts,
    })
  })

  // Each case below starts its own Session with its own prompt, so the fixture root carries over.
  // A slow CLI, so the two wait cases can read the app holding a Turn open.
  test('session-restart-slow-reply', async () => {
    box.set(await restart({ slowReply: true }))
  })

  test('session-reply-wait', async () => {
    await proveReplyWait(box.get(), backend)
  })

  test('session-duplicate-send', async () => {
    await proveDuplicateSend(box.get(), backend, fixture().claudeTranscripts)
  })

  // Last, because naming the Codex row changes the title the cases above open it by.
  test('session-codex-thread-name', async () => {
    await proveCodexThreadName(box.get(), fixture().codexTranscripts)
  })
}
