import assert from 'node:assert/strict'
import test from 'node:test'
import { sessionUnreadFocusReplySchema } from '@/domains/sessions/contract/ipc/contract'
import { claudeSessionSource } from '@/harnesses/claude/sessions/discovery/read-sessions'
import { createInMemorySessionArchiveStore } from '../archive/store/archive-store'
import { createSessionReader } from '../observation/reader/reader'
import { listed, tempRoot, writeClaudeTranscript } from '../observation/reader/reader-test-helpers'
import { createInMemorySessionUnreadStore } from './unread-store'

test('clears unread state when the reader opens a Session', async (context) => {
  const unread = createInMemorySessionUnreadStore()
  const root = await tempRoot(context)
  await writeClaudeTranscript({
    root,
    sessionId: 'session-1',
    text: 'Completed work.',
    updatedAt: '2026-09-20T19:00:00.000Z',
  })
  const state = {
    ...createInMemorySessionArchiveStore(),
    unread,
  }
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })], undefined, state)
  await unread.project((await listed(reader, 'initial'))?.sessions ?? [])
  await unread.setUnread(['session-1'], true)

  const reply = sessionUnreadFocusReplySchema.parse(
    await reader.focusSessionUnread({
      version: 1,
      type: 'session.unread.focus',
      requestId: 'focus-unread',
      sessionId: 'session-1',
    }),
  )

  assert.equal(reply.type, 'session.unread.focused')
  assert.equal((await listed(reader, 'after-focus'))?.sessions[0]?.unread, false)
})
