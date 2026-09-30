// A Claude ACP Session born by clicking streams its reply, then rereads the agent's own history (#2802).
import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright-core'
import {
  mockClaudeAcpFolder,
  mockClaudeAcpRoot,
} from '../../../mocks/cli/claude-acp/mock-claude-acp-transcripts'
import { sendFromComposer } from '../gestures'
import type { SessionHarnessBackend } from '../session-harness-backend'
import { proveSessionCreatedByClick } from './create.case'

const OPENING_PROMPT = 'Open the Claude ACP history proof.'
const FOLLOWING_PROMPT = 'Follow the Claude ACP history proof.'
// A reply only the agent's store holds, so the Feed can show it only by rereading that store.
const VENDOR_ONLY = 'Written by the agent alone.'

async function writeVendorOnlyReply(proofRoot: string, prompt: string) {
  const folder = mockClaudeAcpFolder(mockClaudeAcpRoot(proofRoot))
  for (const name of await readdir(folder)) {
    const file = path.join(folder, name)
    const stored = JSON.parse(await readFile(file, 'utf8')) as { updates: unknown[] }
    if (!JSON.stringify(stored.updates).includes(prompt)) continue
    stored.updates.push({
      sessionUpdate: 'agent_message_chunk',
      messageId: 'vendor-only',
      content: { type: 'text', text: VENDOR_ONLY },
    })
    await writeFile(file, JSON.stringify(stored))
    return
  }
  throw new Error('The mock agent stored no Session for the opening prompt.')
}

export async function proveClaudeAcpHistory(
  page: Page,
  { backend, root }: { backend: SessionHarnessBackend; root: string },
) {
  const sessionId = await proveSessionCreatedByClick(page, backend, {
    harness: 'claude-acp',
    prompt: OPENING_PROMPT,
  })
  await writeVendorOnlyReply(root, OPENING_PROMPT)
  await sendFromComposer(page, FOLLOWING_PROMPT)
  await backend.waitForReply(page, { harness: 'claude-acp', prompt: FOLLOWING_PROMPT })

  const feed = page.locator(`.feed__viewport[data-session="${sessionId}"]`)
  await feed.getByText(VENDOR_ONLY).waitFor({ timeout: backend.budgetMs })
  // Live rows and reread rows share ids, so each prompt and reply draws once.
  for (const text of [OPENING_PROMPT, FOLLOWING_PROMPT, VENDOR_ONLY])
    assert.equal(await feed.getByText(text, { exact: true }).count(), 1, text)
}
