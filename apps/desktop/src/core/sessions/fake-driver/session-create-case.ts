// A Session born by clicking, inside the SHIPPED app: the plus control, the harness tabs, the
// composer and the send chord, with nothing above the fake CLI stubbed (#2117).
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import type { Page } from 'playwright-core'
import { fakeClaudeFolder } from '../../../agents/claude/session-fake-driver/fake-claude-transcripts'
import { createSessionByClick, rosterIds } from './session-gestures'

const PROMPT = 'Start this one by hand.'

// Runs before the resume cases, which are the first to run the fake Claude, so its folder is still
// empty here and the Roster row is held to appearing ahead of anything the CLI writes.
export async function proveSessionCreatedByClick(page: Page, transcripts: string) {
  const folder = fakeClaudeFolder(transcripts)
  const written = async () => (await readdir(folder).catch(() => [])).length > 0
  assert.equal(await written(), false)
  const known = await rosterIds(page)
  const sessionId = await createSessionByClick(page, {
    cli: 'claude',
    prompt: PROMPT,
    cliWrote: written,
  })

  // The gesture ended in a real Session: the fake CLI answers the prompt it was actually sent.
  const history = page.getByRole('region', { name: 'Session history' })
  await history.getByText(`Fake Claude read: ${PROMPT}`).waitFor()
  // Read once the Feed has landed: a duplicate start reaches the Roster a moment behind the row
  // the gesture made, so counting at the first sight of that row would not see it.
  const created = (await rosterIds(page)).filter((id) => !known.includes(id))
  assert.deepEqual(created, [sessionId])
  assert.deepEqual(await readdir(folder), [`${sessionId}.jsonl`])
  return sessionId
}
