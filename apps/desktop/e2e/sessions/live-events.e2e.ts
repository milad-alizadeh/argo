import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { _electron as electron } from 'playwright-core'
import { openDatabase } from '@/database/database'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import { LIVE_EVENT_PROOF_ENV, PROJECT_PROOF_STORE_ENV } from '@/platform/contract/project-proof'
import { signedInHarnessEnvironment } from '../../mocks/cli/signed-in-harness'
import { closeApplication, launchCommand } from '../application-under-test'
import { expect, test } from '../packaged-proof'
import { openRoute } from '../packaged-window'

const projectId = '00000000-0000-4000-8000-000000000091'
const sessionId = '00000000-0000-4000-8000-000000000093'
const commandId = '00000000-0000-4000-8000-000000000094'

const liveEvents: SessionLiveEventBody[] = [
  {
    type: 'content',
    commandId,
    turnId: commandId,
    vendorEventId: commandId,
    content: { id: commandId, kind: 'message', role: 'user', text: 'Inspect this' },
  },
  { type: 'status', commandId, turnId: commandId, vendorEventId: null, status: 'running' },
  {
    type: 'content',
    commandId,
    turnId: commandId,
    vendorEventId: 'reply-1',
    content: { id: 'reply-1', kind: 'message', role: 'assistant', text: 'Reading now' },
  },
  {
    type: 'content',
    commandId,
    turnId: commandId,
    vendorEventId: 'tool-1',
    content: {
      id: 'tool-1',
      kind: 'tool',
      callId: 'call-1',
      name: 'Read',
      status: 'running',
      input: null,
      output: null,
      summary: null,
      // What the Claude adapter names a Read call that states no file.
      presentation: { kind: 'read', label: 'Read file' },
    },
  },
  {
    type: 'permission',
    commandId,
    turnId: commandId,
    vendorEventId: 'permission-1',
    requestId: 'permission-1',
    description: 'Read file',
    decision: null,
  },
  {
    type: 'question',
    commandId,
    turnId: commandId,
    vendorEventId: 'request-1',
    requestId: 'request-1',
    questions: [{ question: 'Which file?', header: null, multiSelect: false, options: [] }],
    answer: 'README.md',
  },
  {
    type: 'question',
    commandId,
    turnId: commandId,
    vendorEventId: 'request-2',
    requestId: 'request-2',
    questions: [{ question: 'Unanswered?', header: null, multiSelect: false, options: [] }],
    answer: null,
  },
]

async function seedSession(root: string): Promise<string> {
  const userData = path.join(root, 'user-data')
  const projectPath = path.join(root, 'project')
  await mkdir(projectPath, { recursive: true })
  const database = openDatabase(userData)
  database.$client
    .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
    .run(projectId, projectPath, projectPath)
  database.$client
    .prepare(
      'INSERT INTO session (argo_id, harness, native_id, project_id, cwd, first_prompt) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(sessionId, 'claude', 'native-live-feed-proof', projectId, projectPath, 'Inspect this')
  database.$client.close()
  return userData
}

test('packaged Feed replays ordered Claude live activity for a stored Session', async ({
  root,
  applicationUnderTest,
}) => {
  const userData = await seedSession(root)
  const application = await electron.launch({
    ...launchCommand(applicationUnderTest),
    env: {
      ...process.env,
      ...(await signedInHarnessEnvironment(root)),
      [PROJECT_PROOF_STORE_ENV]: userData,
      [LIVE_EVENT_PROOF_ENV]: JSON.stringify(liveEvents.map((body) => ({ sessionId, body }))),
    },
  })
  try {
    const page = await application.firstWindow()
    await openRoute(page, `#/projects/${projectId}/sessions/${sessionId}`)
    const feed = page.getByRole('region', { name: 'Session Feed' })
    await expect(feed.getByText('Inspect this', { exact: true })).toBeVisible()
    await expect(feed.getByText('Reading now', { exact: true })).toBeVisible()
    await expect(feed.getByText('README.md', { exact: true })).toBeVisible()
    await expect(feed.getByRole('button', { name: /Read/ })).toBeVisible()
    await expect(feed.getByText('Permission needed')).toHaveCount(0)
    await expect(feed.getByText('Unanswered?', { exact: true })).toHaveCount(0)
    const rows = await feed.locator('[data-feed-row]').allTextContents()
    expect(rows.map((row) => row.trim())).toEqual([
      expect.stringContaining('Inspect this'),
      expect.stringContaining('Running'),
      expect.stringContaining('Reading now'),
      expect.stringContaining('Read'),
      expect.stringContaining('README.md'),
    ])
  } finally {
    await closeApplication(application)
  }
})
