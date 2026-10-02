import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'
import { openOneTurnCodexChannel } from '../../../../mocks/cli/codex/mock-codex-channel'

// Shaped like the codex-cli 0.157.0 app-server's ThreadTokenUsageUpdatedNotification.
function tokenUsage(turnId: string, lastTokens: number, threadId = 'thread-1') {
  const breakdown = (totalTokens: number) => ({
    totalTokens,
    inputTokens: totalTokens,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  })
  return {
    method: 'thread/tokenUsage/updated',
    params: {
      threadId,
      turnId,
      tokenUsage: {
        last: breakdown(lastTokens),
        total: breakdown(90_000),
        modelContextWindow: 256_000,
      },
    },
  }
}

test('a Codex Turn reports its newest model call as context usage when it ends', async () => {
  const { channel, events, notify } = await openOneTurnCodexChannel()
  notify(tokenUsage('turn-1', 30_000))
  notify(tokenUsage('turn-1', 41_000))
  notify(tokenUsage('turn-1', 99_000, 'other-thread'))
  notify(tokenUsage('other-turn', 99_000))
  assert.equal(
    events.some((event) => event.type === 'context.usage'),
    false,
  )
  notify({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } },
  })
  const reported = events.flatMap((event) => (event.type === 'context.usage' ? [event] : []))
  assert.deepEqual(reported, [
    { type: 'context.usage', usage: { usedTokens: 41_000, windowTokens: 256_000 } },
  ])
  assert.ok(
    events.indexOf(reported[0] as LiveSessionChannelEvent) <
      events.findIndex((event) => event.type === 'turn.completed'),
  )
  channel.close()
})
