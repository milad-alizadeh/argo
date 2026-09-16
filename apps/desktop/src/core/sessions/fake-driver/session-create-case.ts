// A Session born by clicking, inside the SHIPPED app: the plus control, the harness tabs, the
// composer and the send chord, with nothing above the CLI stubbed (#2117).
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import type { SessionCli } from '../../../renderer/modules/sessions/harness/harnesses'
import type { SessionCliBackend } from './session-cli-backend'
import { createSessionByClick, rosterIds } from './session-gestures'

const PROMPTS: Record<SessionCli, string> = {
  claude: 'Reply with one short acknowledgement.',
  codex: 'Reply with one short acknowledgement.',
}

// Runs before the resume cases, which are the first to run the CLI, so its folder is still empty
// here and the Roster row is held to appearing ahead of anything the CLI writes.
export async function proveSessionCreatedByClick(
  page: Page,
  backend: SessionCliBackend,
  cli: SessionCli = 'claude',
) {
  const prompt = PROMPTS[cli]
  const reply = { cli, prompt }
  assert.equal(await backend.recorded(reply), false)
  const known = await rosterIds(page)
  const sessionId = await createSessionByClick(page, {
    cli,
    prompt,
    cliWrote: () => backend.recorded(reply),
  })

  // The gesture ended in a real Session: the CLI answers the prompt it was actually sent.
  await backend.waitForReply(page, reply)
  // Read once the Feed has landed: a duplicate start reaches the Roster a moment behind the row
  // the gesture made, so counting at the first sight of that row would not see it.
  const created = (await rosterIds(page)).filter((id) => !known.includes(id))
  assert.deepEqual(created, [sessionId])
  return sessionId
}
