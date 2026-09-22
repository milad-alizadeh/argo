import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HistoryTransport } from './vendor-history'
import { readResumePermission } from './vendor-history'

const THREAD = {
  id: 'thread-1',
  cwd: '/work/checkout',
  name: 'Old notes',
  updatedAt: 1_700_000_000,
  status: { type: 'idle' },
}

function transport(
  handlers: Record<string, (params: Record<string, unknown>) => unknown>,
): HistoryTransport {
  return {
    request: (method, params) => {
      const handler = handlers[method]
      if (handler === undefined) throw new Error(`unexpected ${method}`)
      return Promise.resolve(handler(params))
    },
  }
}

test('refuses resume when the vendor reports the Session is active', async () => {
  const vendor = transport({
    'thread/read': () => ({
      thread: {
        ...THREAD,
        status: { type: 'active', message: 'Another Codex client holds this Session.' },
      },
    }),
    'thread/loaded/list': () => ({ data: [] }),
  })
  assert.deepEqual(await readResumePermission(vendor, 'thread-1'), {
    resumable: false,
    reason: 'Another Codex client holds this Session.',
  })
})

test('checks every loaded-thread page before allowing resume', async () => {
  const vendor = transport({
    'thread/read': () => ({ thread: THREAD }),
    'thread/loaded/list': (params) =>
      params.cursor === undefined
        ? { data: ['another-thread'], nextCursor: 'next' }
        : { data: ['thread-1'], nextCursor: null },
  })
  assert.deepEqual(await readResumePermission(vendor, 'thread-1'), {
    resumable: false,
    reason: 'Codex status is active.',
  })
})
