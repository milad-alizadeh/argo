import assert from 'node:assert/strict'
import test from 'node:test'
import { createInMemorySessionUnreadStore } from './unread-store'

test('keeps existing Sessions read, then marks a completed newer turn unread', async () => {
  const unread = createInMemorySessionUnreadStore()
  const first = {
    id: 'session-1',
    retiredIds: [],
    status: 'idle' as const,
    updatedAt: '2026-09-20T10:00:00.000Z',
  }

  assert.equal((await unread.project([first]))[0]?.unread, false)
  assert.equal(
    (
      await unread.project([
        { ...first, status: 'running' as const, updatedAt: '2026-09-20T10:01:00.000Z' },
      ])
    )[0]?.unread,
    false,
  )
  assert.equal(
    (await unread.project([{ ...first, updatedAt: '2026-09-20T10:02:00.000Z' }]))[0]?.unread,
    true,
  )
})

test('keeps an unseen result through its next running turn and after it settles', async () => {
  const unread = createInMemorySessionUnreadStore()
  const result = {
    id: 'session-1',
    retiredIds: [],
    status: 'idle' as const,
    updatedAt: '2026-09-20T10:00:00.000Z',
  }

  await unread.project([result])
  await unread.setUnread([result], true)
  assert.equal(
    (
      await unread.project([
        { ...result, status: 'running' as const, updatedAt: '2026-09-20T10:01:00.000Z' },
      ])
    )[0]?.unread,
    true,
  )
  assert.equal(
    (await unread.project([{ ...result, updatedAt: '2026-09-20T10:02:00.000Z' }]))[0]?.unread,
    true,
  )
})

test('focus and explicit actions set persisted reader state', async () => {
  const unread = createInMemorySessionUnreadStore()
  const row = {
    id: 'session-1',
    retiredIds: [],
    status: 'idle' as const,
    updatedAt: '2026-09-20T10:00:00.000Z',
  }

  await unread.project([row])
  await unread.setUnread([row], true)
  assert.equal((await unread.project([row]))[0]?.unread, true)
  await unread.focus(row)
  assert.equal((await unread.project([row]))[0]?.unread, false)
  await unread.setUnread([row], false)
  assert.equal((await unread.project([row]))[0]?.unread, false)
})

test('focus and explicit updates resolve a Session through its retired ids', async () => {
  const unread = createInMemorySessionUnreadStore()
  const retired = { id: 'old-session', retiredIds: [], status: 'idle' as const, updatedAt: null }
  const resumed = {
    ...retired,
    id: 'resumed-session',
    retiredIds: ['old-session'],
  }

  await unread.project([retired])
  await unread.setUnread([retired], true)
  await unread.setUnread([resumed], false)
  assert.equal((await unread.project([retired]))[0]?.unread, false)

  await unread.setUnread([retired], true)
  await unread.focus(resumed)
  assert.equal((await unread.project([retired]))[0]?.unread, false)
})
