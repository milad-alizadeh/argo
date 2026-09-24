// A Session born by clicking, inside the shipped app, drives the plus control, harness tabs, composer and send chord (#2117).
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { createSessionByClick, sessionListIds } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'

const PROMPT = 'Reply with one short acknowledgement.'

// The mock folder starts empty, so the SessionList row must precede a Harness transcript.
export async function proveSessionCreatedByClick(
  page: Page,
  backend: SessionHarnessBackend,
  options: {
    harness?: SessionHarness
    prompt?: string
    budgetRunSetup?: boolean
    permissionMode?: 'auto'
  } = {},
) {
  const { harness = 'claude', prompt = PROMPT, budgetRunSetup = false, permissionMode } = options
  const reply = { harness, prompt }
  assert.equal(await backend.recorded(reply), false)
  const known = await sessionListIds(page)
  const sessionId = await createSessionByClick(page, {
    harness,
    prompt,
    budgetRunSetup,
    permissionMode,
    harnessWrote: () => backend.recorded(reply),
  })

  // The gesture ended in a real Session: the Harness answers the prompt it was sent.
  await backend.waitForReply(page, reply)
  // Read after the Feed lands because a duplicate start can reach the SessionList behind the new row.
  const created = (await sessionListIds(page)).filter((id) => !known.includes(id))
  assert.deepEqual(created, [sessionId])
  return sessionId
}
