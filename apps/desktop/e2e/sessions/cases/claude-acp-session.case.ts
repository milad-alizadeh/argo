import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from 'playwright-core'
import {
  mockClaudeAcpFolder,
  mockClaudeAcpRoot,
} from '../../../mocks/cli/claude-acp/mock-claude-acp-transcripts'
import { openSessionByClick, sendFromComposer } from '../gestures'
import { sessionDetails } from '../page-trpc'
import type { SessionHarnessBackend } from '../session-harness-backend'
import { proveSessionCreatedByClick } from './create.case'

const EXTERNAL_ID = '22222222-3333-4444-8555-666666666666'
const EXTERNAL_PROMPT = 'External ACP conversation'
const EXTERNAL_REPLY = 'Reply stored by the external ACP agent.'
const ARGO_PROMPT = 'Argo ACP conversation'

async function refresh(page: Page) {
  await page.getByRole('button', { name: 'Filter Sessions' }).click()
  await page.getByRole('menuitem', { name: 'Refresh Sessions' }).click()
}

export async function proveClaudeAcpDiscovery(
  page: Page,
  host: {
    root: string
    project: string
    backend: SessionHarnessBackend
    restart: () => Promise<Page>
  },
) {
  const sessionId = await proveSessionCreatedByClick(page, host.backend, {
    harness: 'claude-acp',
    prompt: ARGO_PROMPT,
  })
  const folder = mockClaudeAcpFolder(mockClaudeAcpRoot(host.root))
  await mkdir(folder, { recursive: true })
  await writeFile(
    path.join(folder, `${EXTERNAL_ID}.json`),
    JSON.stringify({
      cwd: host.project,
      updates: [
        { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: EXTERNAL_PROMPT } },
        {
          sessionUpdate: 'agent_message_chunk',
          messageId: 'external-reply',
          content: { type: 'text', text: EXTERNAL_REPLY },
        },
      ],
    }),
  )
  await refresh(page)
  const row = page.getByRole('button', { name: new RegExp(ARGO_PROMPT) })
  await row.waitFor()
  await refresh(page)
  assert.equal(await row.count(), 1)
  assert.equal(await row.getAttribute('data-session-id'), sessionId)
  const restarted = await host.restart()
  await openSessionByClick(restarted, sessionId)
  await host.backend.waitForReply(restarted, { harness: 'claude-acp', prompt: ARGO_PROMPT })
  await sendFromComposer(restarted, 'Continue the saved ACP conversation')
  await host.backend.waitForReply(restarted, {
    harness: 'claude-acp',
    prompt: 'Continue the saved ACP conversation',
  })
  assert.equal((await sessionDetails(restarted, sessionId))?.id, sessionId)
  const feed = restarted.getByRole('region', { name: 'Session history' })
  assert.equal(await feed.getByText(ARGO_PROMPT, { exact: true }).count(), 1)
  assert.equal(
    await restarted.getByRole('button', { name: new RegExp(EXTERNAL_PROMPT) }).count(),
    0,
  )
}

export async function proveClaudeAcpControls(page: Page, backend: SessionHarnessBackend) {
  await proveSessionCreatedByClick(page, backend, {
    harness: 'claude-acp',
    prompt: 'Open ACP controls',
  })
  await sendFromComposer(page, 'Request ACP permission')
  await page.getByRole('heading', { name: 'Permission needed' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'More ways to allow' }).count(), 0)
  await page.getByRole('button', { name: 'Allow', exact: true }).click()
  await backend.waitForReply(page, { harness: 'claude-acp', prompt: 'Request ACP permission' })
  await sendFromComposer(page, 'Request ACP permission')
  await page.getByRole('heading', { name: 'Permission needed' }).waitFor()
  await page.getByRole('button', { name: 'Interrupt', exact: true }).click()
  await page.getByRole('heading', { name: 'Permission needed' }).waitFor({ state: 'hidden' })
  await sendFromComposer(page, 'Continue after ACP interrupt')
  await backend.waitForReply(page, {
    harness: 'claude-acp',
    prompt: 'Continue after ACP interrupt',
  })
}
