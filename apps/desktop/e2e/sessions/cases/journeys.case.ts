// The Session journeys: a person starts a Session, sends a Turn, restarts the app, resumes and renames (#2308).
import type { PageBox, SessionProofRun } from '../session-proof-run'
import { test } from '../session-proof-run'
import { proveClaudeRename } from './claude-rename.case'
import { provePackagedResume } from './claude-resume.case'
import { provePackagedCodexResume } from './codex-resume.case'
import { proveCodexThreadName } from './codex-thread-name.case'
import { proveSessionCreatedByClick } from './create.case'
import { proveDuplicateSend, proveReplyWait } from './reply-delay.case'
import { proveComposerMemory } from './turn-setup.case'

const SEEDED = 'Reads seeded transcripts or a scripted reply that only the mock backend provides.'

export function defineSessionJourneyCases(run: SessionProofRun, box: PageBox) {
  test('session-composer-memory', async ({ sessionBackend }) => {
    test.skip(sessionBackend !== 'mock', SEEDED)
    await proveComposerMemory(box.get())
  })

  // Before the resume cases, for the reason create.case.ts records.
  test('session-created-by-click', async () => {
    await proveSessionCreatedByClick(box.get(), run.backend)
  })

  test('session-codex-created-by-click', async ({ sessionBackend }) => {
    test.skip(
      sessionBackend === 'mock',
      'The mock creates its Codex Session in session-codex-resume.',
    )
    await proveSessionCreatedByClick(box.get(), run.backend, 'codex')
  })

  test('session-claude-resume', async ({ sessionBackend }) => {
    test.skip(sessionBackend !== 'mock', SEEDED)
    box.set(
      await provePackagedResume(box.get(), {
        backend: run.backend,
        project: run.fixture.project,
        restart: run.restart,
        transcripts: run.fixture.claudeTranscripts,
      }),
    )
  })

  test('session-codex-resume', async ({ sessionBackend }) => {
    test.skip(sessionBackend !== 'mock', SEEDED)
    box.set(
      await provePackagedCodexResume(box.get(), { backend: run.backend, restart: run.restart }),
    )
  })

  test('session-claude-rename', async ({ sessionBackend }) => {
    test.skip(sessionBackend !== 'mock', SEEDED)
    await proveClaudeRename(box.get(), {
      backend: run.backend,
      project: run.fixture.project,
      transcripts: run.fixture.claudeTranscripts,
    })
  })

  // A slow mock CLI, so the two wait cases can read the app holding a Turn open.
  test('session-restart-slow-reply', async ({ sessionBackend }) => {
    test.skip(sessionBackend !== 'mock', SEEDED)
    box.set(await run.restart({ slowReply: true }))
  })

  test('session-reply-wait', async () => {
    await proveReplyWait(box.get(), run.backend)
  })

  test('session-duplicate-send', async () => {
    await proveDuplicateSend(box.get(), run.backend)
  })

  // Last, because naming the Codex row changes the title the cases above open it by.
  test('session-codex-thread-name', async ({ sessionBackend }) => {
    test.skip(sessionBackend !== 'mock', SEEDED)
    await proveCodexThreadName(box.get(), run.fixture.codexTranscripts)
  })
}
