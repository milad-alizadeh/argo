import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { LiveMessage } from '@/agents/codex/drive/codex-session-driver'
import { codexSessionSource } from '@/agents/codex/sessions/read-sessions'
import { createSessionReader } from '@/domains/sessions/main/reader'

const SESSION = 'codexHeartbeat'
const FIXTURE = fileURLToPath(
  new URL(
    '../../../../mocks/cli/codex/fixtures/sessions/rollout-codexHeartbeat.jsonl',
    import.meta.url,
  ),
)

async function feed(
  context: { after: (cleanup: () => Promise<void>) => void },
  live: LiveMessage[] = [],
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-harness-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '15')
  await mkdir(day, { recursive: true })
  await copyFile(FIXTURE, path.join(day, `${SESSION}.jsonl`))
  const reader = createSessionReader([codexSessionSource(root, { liveMessages: () => live })])
  const reply = await reader.readSessionFeed({
    version: 1,
    type: 'session.feed',
    requestId: 'feed-1',
    sessionId: SESSION,
    delegationId: null,
    revision: null,
  })
  assert.ok(typeof reply === 'object' && reply !== null && 'rows' in reply)
  return (reply as { rows: Record<string, unknown>[] }).rows
}

function visible(rows: Record<string, unknown>[]) {
  return rows.map(({ id, shape, text, event, action }) =>
    Object.fromEntries(
      Object.entries({ id, shape, text, event, action }).filter(([, value]) => value),
    ),
  )
}

test('shows the person, the agent and a heartbeat notification, never the heartbeat markup', async (context) => {
  const rows = await feed(context)
  assert.deepEqual(visible(rows), [
    { id: 'prompt-1:0', shape: 'prose', text: 'Tell me when the Argo fixes are ready to review.' },
    {
      id: 'msg_ack:0',
      shape: 'prose',
      text: 'I will check every 30 minutes and tell you when a pull request is ready.',
    },
    {
      id: 'msg_notify:0',
      shape: 'prose',
      text: 'Merged #2192, which fixes stalled session retries.',
    },
    {
      id: 'msg_notify:1',
      shape: 'event',
      event: 'status',
      text: 'Merged #2192: stalled session retry recovery.',
    },
    { id: 'voice-1', shape: 'delegation', action: 'Check the feed virtualisation next' },
    { id: 'browser-1:0', shape: 'prose', text: 'start again' },
  ])
  assert.ok(rows.every((row) => !JSON.stringify(row).includes('<heartbeat>')))
})

test('streams a notifying reply without its heartbeat block, and a quiet one not at all', async (context) => {
  const rows = await feed(context, [
    { id: 'msg_live_quiet', text: '<heartbeat>\n  <automation_id>notify-when' },
    { id: 'msg_live_notify', text: 'Merged #2193.\n\n<heart' },
  ])
  assert.deepEqual(visible(rows.slice(-1)), [
    { id: 'msg_live_notify:0', shape: 'prose', text: 'Merged #2193.' },
  ])
  assert.ok(!rows.some((row) => row.id === 'msg_live_quiet:0'))
})

test('opens a thread the voice session created with its request, never the injected instructions', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-created-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '15')
  await mkdir(day, { recursive: true })
  const session = 'codexCreatedThread'
  await copyFile(
    fileURLToPath(
      new URL(
        `../../../../mocks/cli/codex/fixtures/sessions/rollout-${session}.jsonl`,
        import.meta.url,
      ),
    ),
    path.join(day, `${session}.jsonl`),
  )
  const reply = await createSessionReader([codexSessionSource(root)]).readSessionFeed({
    version: 1,
    type: 'session.feed',
    requestId: 'feed-1',
    sessionId: session,
    delegationId: null,
    revision: null,
  })
  assert.ok(typeof reply === 'object' && reply !== null && 'rows' in reply)
  assert.deepEqual(visible((reply as { rows: Record<string, unknown>[] }).rows), [
    {
      id: 'fco_delegation:0',
      shape: 'prose',
      text: 'Implement the approved Geist desktop typography contract for Argo issue #2235.\n\nWork in a dedicated worktree and do not open a pull request.',
    },
    {
      id: 'msg_start:0',
      shape: 'prose',
      text: "I am starting with the repository's own instructions.",
    },
  ])
})
