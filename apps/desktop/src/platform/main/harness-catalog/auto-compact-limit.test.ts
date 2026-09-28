import { expect, test } from 'bun:test'
import { initTRPC } from '@trpc/server'
import { autoCompactLimitReadProcedure, autoCompactLimitWriteProcedure } from './auto-compact-limit'

function callerFor(lookup: Parameters<typeof autoCompactLimitReadProcedure>[0]) {
  const t = initTRPC.create()
  return t
    .router({
      read: autoCompactLimitReadProcedure(lookup),
      write: autoCompactLimitWriteProcedure(lookup),
    })
    .createCaller({})
}

test('reads and writes the limit through the Harness that declares it', async () => {
  let stored = 180_000
  const caller = callerFor((harness) =>
    harness === 'codex'
      ? {
          read: async () => stored,
          write: async (limit) => {
            stored = limit
            return stored
          },
        }
      : undefined,
  )
  await expect(caller.read({ harness: 'codex' })).resolves.toBe(180_000)
  await expect(caller.write({ harness: 'codex', limit: 120_000 })).resolves.toBe(120_000)
  await expect(caller.read({ harness: 'codex' })).resolves.toBe(120_000)
})

test('refuses a Harness without an auto-compact limit', async () => {
  const caller = callerFor(() => undefined)
  await expect(caller.read({ harness: 'claude' })).rejects.toThrow(
    'This Harness has no auto-compact limit to change.',
  )
  await expect(caller.write({ harness: 'claude', limit: 120_000 })).rejects.toThrow(
    'This Harness has no auto-compact limit to change.',
  )
})
