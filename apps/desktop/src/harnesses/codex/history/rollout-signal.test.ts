import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRolloutInvalidation, threadIdFromRolloutSignal } from './rollout-signal'

test('a rollout filename asks for one app-server read and does not carry file contents', async () => {
  const reads: string[] = []
  let signal: (filename: string | null) => void = () => {}
  const stop = createRolloutInvalidation({
    subscribe: (onFilename) => {
      signal = onFilename
      return () => undefined
    },
    readThread: async (threadId) => {
      reads.push(threadId)
    },
    readAll: async () => {
      reads.push('all')
    },
  })
  const filename =
    '2026/09/22/rollout-2026-09-22T01-02-03-018f6b2a-7c31-7a1e-8f0a-6b2c0d4e5f60.jsonl'
  assert.equal(threadIdFromRolloutSignal(filename), '018f6b2a-7c31-7a1e-8f0a-6b2c0d4e5f60')
  signal(filename)
  signal('notes.txt')
  await Promise.resolve()
  assert.deepEqual(reads, ['018f6b2a-7c31-7a1e-8f0a-6b2c0d4e5f60', 'all'])
  stop()
})

test('a missed thread read falls back to the complete vendor listing', async () => {
  const reads: string[] = []
  let signal: (filename: string | null) => void = () => {}
  createRolloutInvalidation({
    subscribe: (onFilename) => {
      signal = onFilename
      return () => undefined
    },
    readThread: async (threadId) => {
      reads.push(threadId)
      throw new Error('Codex no longer lists that thread')
    },
    readAll: async () => {
      reads.push('all')
    },
  })
  signal('018f6b2a-7c31-7a1e-8f0a-6b2c0d4e5f60.jsonl')
  await Promise.resolve()
  await Promise.resolve()
  assert.deepEqual(reads, ['018f6b2a-7c31-7a1e-8f0a-6b2c0d4e5f60', 'all'])
})
