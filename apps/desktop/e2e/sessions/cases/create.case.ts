// A Session born by clicking, inside the shipped app, drives the plus control, harness tabs, composer and send chord (#2117).
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import type { SessionCliBackend } from '../../../mocks/sessions/session-cli-backend'
import type { SessionCli } from '../../../src/renderer/modules/sessions/harness/harnesses'
import { createSessionByClick, rosterIds } from '../gestures'

const PROMPT = 'Reply with one short acknowledgement.'

// This runs before the resume cases, so its folder remains empty and the Roster row must precede a CLI transcript.
export async function proveSessionCreatedByClick(
  page: Page,
  backend: SessionCliBackend,
  cli: SessionCli = 'claude',
) {
  const reply = { cli, prompt: PROMPT }
  assert.equal(await backend.recorded(reply), false)
  const known = await rosterIds(page)
  const sessionId = await createSessionByClick(page, {
    cli,
    prompt: PROMPT,
    cliWrote: () => backend.recorded(reply),
  })

  // The gesture ended in a real Session: the CLI answers the prompt it was sent.
  await backend.waitForReply(page, reply)
  // Read after the Feed lands because a duplicate start can reach the Roster behind the new row.
  const created = (await rosterIds(page)).filter((id) => !known.includes(id))
  assert.deepEqual(created, [sessionId])
  return sessionId
}
