import assert from 'node:assert/strict'
import { test } from 'node:test'

import { STARTED_AT, startedSession } from '@/harnesses/claude/integration/claude-driver-launch.ts'

test('keeps the selected Session compacting until a newer compact boundary arrives', async (context) => {
  const { driver, sessionId, writes } = await startedSession(context)

  await driver.compact(sessionId)

  assert.deepEqual(writes, ['/compact', '\r'])
  const startedAt = driver.roster()[0]?.compactionStartedAt
  assert.notEqual(startedAt, null)
  if (startedAt === null || startedAt === undefined) throw new Error('Compaction did not start.')
  driver.completeCompaction(sessionId, new Date(Date.parse(startedAt) + 1).toISOString())
  assert.equal(driver.roster()[0]?.compactionStartedAt, null)
})

test('a compaction Argo did not ask for reads its progress off the screen once the hook sees it start', async (context) => {
  const { driver, sessionId, paint } = await startedSession(context)
  const startedAt = '2026-09-13T15:18:00.000Z'

  driver.beginCompaction(sessionId, startedAt)
  paint(0, 'Compacting conversation… (1m 31s · ↓ 12.4k tokens) 40%\r\n')

  assert.deepEqual(
    driver.roster().map(({ compactionStartedAt, compactionPercentage, compactionTokens }) => ({
      compactionStartedAt,
      compactionPercentage,
      compactionTokens,
    })),
    [
      {
        compactionStartedAt: startedAt,
        compactionPercentage: 40,
        compactionTokens: '12.4k tokens',
      },
    ],
  )
})

test('a compaction Argo asked for keeps its own start when the hook sees it too', async (context) => {
  const { driver, sessionId } = await startedSession(context)

  await driver.compact(sessionId)
  driver.beginCompaction(sessionId, '2026-09-13T15:18:00.000Z')

  assert.equal(driver.roster()[0]?.compactionStartedAt, STARTED_AT.toISOString())
})
