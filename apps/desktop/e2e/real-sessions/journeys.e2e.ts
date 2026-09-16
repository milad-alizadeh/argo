// The portable Session journeys against subscription-authenticated CLIs; fixture cases stay mock-only.
import { test } from '@playwright/test'
import { proveSessionCreatedByClick } from '../sessions/cases/create.case'
import { proveDuplicateSend, proveReplyWait } from '../sessions/cases/reply-delay.case'
import {
  createPageBox,
  defineLaunchWithProject,
  describeSessionProof,
} from '../sessions/session-proof-run'
import { createRealSessionCliBackend } from './real-session-cli-backend'

const backend = createRealSessionCliBackend()

describeSessionProof('real-session-journeys', backend, (run) => {
  const box = createPageBox(run.hold)
  defineLaunchWithProject(run, box)

  test('real-claude-session-created-by-click', async () => {
    await proveSessionCreatedByClick(box.get(), backend, 'claude')
  })

  test('real-codex-session-created-by-click', async () => {
    await proveSessionCreatedByClick(box.get(), backend, 'codex')
  })

  test('real-session-reply-wait', async () => {
    await proveReplyWait(box.get(), backend)
  })

  test('real-session-duplicate-send', async () => {
    await proveDuplicateSend(box.get(), backend)
  })
})
