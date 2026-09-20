import assert from 'node:assert/strict'
import test from 'node:test'
import { createInMemorySessionUnreadStore } from '@/domains/sessions/main/unread/unread-store'

test('keeps existing Sessions read, then marks a completed newer turn unread', async () => {
  const unread = createInMemorySessionUnreadStore()
  const first = { id: 'session-1', retiredIds: [], status: 'idle' as const, updatedAt: '2026-09-20T10:00:00.000Z' }

  assert.equal((await unread.project([first]))[0]?.unread, false)
  assert.equal((await unread.project([{ ...first, status: 'running' as const, updatedAt: '2026-09-20T10:01:00.000Z' }]))[0]?.unread, false)
  assert.equal((await unread.project([{ ...first, updatedAt: '2026-09-20T10:02:00.000Z' }]))[0]?.unread, true)
})

test('focus and explicit actions set persisted reader state', async () => {
  const unread = createInMemorySessionUnreadStore()
  const row = { id: 'session-1', retiredIds: [], status: 'idle' as const, updatedAt: '2026-09-20T10:00:00.000Z' }

  await unread.project([row])
  await unread.setUnread(['session-1'], true)
  assert.equal((await unread.project([row]))[0]?.unread, true)
  await unread.focus('session-1')
  assert.equal((await unread.project([row]))[0]?.unread, false)
  await unread.setUnread(['session-1'], false)
  assert.equal((await unread.project([row]))[0]?.unread, false)
})
