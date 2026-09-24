// Feed-reading behavior of the shared Session reader (#2025): caching, staleness, missing
// Sessions, and request validation. Split from reader.test.ts to stay under the file-length gate.
import assert from 'node:assert/strict'
import { chmod } from 'node:fs/promises'
import { test } from 'node:test'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { sessionListReplySchema } from '@/domains/sessions/contract/ipc/contract'
import { createClaudeSdkHistorySource } from '@/harnesses/claude/agent-sdk/claude-sdk-history-source'
import { claudeSessionSource } from '@/harnesses/claude/sessions/discovery/read-sessions'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'
import { createSessionReader } from './reader'
import {
  appendCodexTranscript,
  fed,
  feedRequest,
  listed,
  listing,
  tempRoot,
  writeClaudeTranscript,
  writeCodexTranscript,
} from './reader-test-helpers'

test('answers with the first error when every Harness folder is missing', async (context) => {
  const root = await tempRoot(context)
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: `${root}/claude-absent` }),
    codexSessionSource(`${root}/codex-absent`),
  ])

  const reply = sessionListReplySchema.parse(await reader.listSessions(listing()))
  assert.equal(reply.type, 'session.error')
  assert.equal(reply.type === 'session.error' && reply.code, 'transcripts-unavailable')
})

test('names a folder it cannot reach rather than reading as an empty machine', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'claudeOne',
    text: 'Hi.',
    updatedAt: '2026-09-13T09:00:00.000Z',
  })
  await chmod(claudeRoot, 0o000)
  context.after(() => chmod(claudeRoot, 0o700))
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  const reply = await listed(reader)
  // Codex's own sweep found nothing, so the combined answer still lists it as reached.
  assert.deepEqual(reply?.sessions, [])
})

test('reads a Session’s Feed as unchanged, and with a new revision once it grows', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'growing',
    text: 'First.',
    updatedAt: '2026-09-13T09:00:00.000Z',
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  const first = await fed(reader, feedRequest('growing'))
  assert.equal(first.type, 'session.feed.read')
  const unchanged = await fed(
    reader,
    feedRequest('growing', 'feed-2', first.type === 'session.feed.read' ? first.revision : null),
  )
  assert.equal(unchanged.type, 'session.feed.unchanged')

  await writeClaudeTranscript({
    root: claudeRoot,
    sessionId: 'growing',
    text: 'Second.',
    updatedAt: '2026-09-13T09:00:05.000Z',
  })
  const grown = await fed(reader, feedRequest('growing', 'feed-3'))
  assert.equal(grown.type, 'session.feed.read')
  assert.notEqual(
    grown.type === 'session.feed.read' ? grown.revision : null,
    first.type === 'session.feed.read' ? first.revision : null,
  )
})

test('reads an SDK Subagent Feed without statting its virtual transcript path', async () => {
  const sessionId = 'claude-parent'
  const subagentId = 'toolu_spawn'
  const parentMessages: SessionMessage[] = [
    {
      type: 'user',
      uuid: 'task-notification',
      session_id: sessionId,
      message: {
        content:
          '<task-notification><task-id>agent-child</task-id><tool-use-id>toolu_spawn</tool-use-id><status>completed</status><summary>Agent "Child" finished</summary></task-notification>',
      },
      parent_tool_use_id: null,
      parent_agent_id: null,
    },
  ]
  const source = createClaudeSdkHistorySource({
    history: {
      listSessions: async () => [{ sessionId, summary: 'Parent', lastModified: 1 }],
      getSessionMessages: async () => parentMessages,
      getSubagentMessages: async () => [
        {
          type: 'user',
          uuid: 'child-message',
          session_id: sessionId,
          message: { content: 'Child transcript loaded.' },
          parent_tool_use_id: null,
          parent_agent_id: 'agent-child',
        },
      ],
    },
  })
  const reader = createSessionReader([source])
  await listed(reader)
  const parent = await fed(reader, feedRequest(sessionId))
  assert.equal(parent.type, 'session.feed.read')

  const child = await fed(reader, {
    ...feedRequest(sessionId, 'child-feed'),
    subagentId,
  })

  assert.equal(child.type, 'session.feed.read')
  assert.equal(
    child.type === 'session.feed.read' &&
      child.rows.some((row) => row.shape === 'prose' && row.text === 'Child transcript loaded.'),
    true,
  )
})

// The settle loop's bound (SETTLING_READS, feed-cache.ts) exists so a transcript an external Harness
// never stops writing still answers instead of holding the reply open forever (#2095, #2102).
test('settles late on a transcript that never stops changing, instead of never answering', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  await writeCodexTranscript({
    root: codexRoot,
    sessionId: 'busy',
    text: 'First.',
    updatedAt: '2026-09-13T09:00:00.000Z',
  })
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  let writing = true
  const keepWriting = (async () => {
    let turn = 0
    while (writing) {
      turn += 1
      await appendCodexTranscript({
        root: codexRoot,
        sessionId: 'busy',
        text: `Turn ${turn}.`,
        updatedAt: '2026-09-13T09:00:00.000Z',
      })
    }
  })()

  const reply = await fed(reader, feedRequest('busy'))
  writing = false
  await keepWriting

  assert.equal(reply.type, 'session.feed.read')
})

test('says a Session is missing when no Harness can find it', async (context) => {
  const claudeRoot = await tempRoot(context)
  const codexRoot = await tempRoot(context)
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: claudeRoot }),
    codexSessionSource(codexRoot),
  ])

  const reply = await fed(reader, feedRequest('nowhere'))
  assert.equal(reply.type, 'session.error')
  assert.equal(reply.type === 'session.error' && reply.code, 'missing-session')
})
