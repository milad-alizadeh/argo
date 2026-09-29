import { expect, test } from 'vitest'
import { sessionTable } from '@/database/session/schema'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import {
  chainReads,
  collect,
  content,
  database,
  journal,
  message,
  observe,
  registerFeedDatabase,
  rowIds,
  sessionId,
} from './session-feed-harness'

registerFeedDatabase()

// A second observer on the same router, so both share its readers.
async function also(feed: Awaited<ReturnType<typeof observe>>, subagentId: string) {
  return collect(await feed.caller.sessionFeed({ sessionId, subagentId }))
}

function delegation(
  id: string,
  event: 'started' | 'messaged' | 'responded',
  facts: { status?: 'completed' | 'failed'; prompt?: string; summary?: string } = {},
): FeedContent {
  return {
    kind: 'delegation',
    id,
    event,
    agentId: 'agent-1',
    status: facts.status ?? 'running',
    name: 'Survey adapters',
    prompt: facts.prompt ?? null,
    model: null,
    summary: facts.summary ?? null,
  }
}

test('each chain reads its stored Harness, native id and working directory', async () => {
  const codexId = '00000000-0000-4000-8000-000000000009'
  database
    .insert(sessionTable)
    .values({
      argoId: codexId,
      harness: 'codex',
      nativeId: 'root-thread',
      cwd: '/work/project',
    })
    .run()
  const targets: unknown[] = []
  const reads = chainReads()
  const readHistory = (harness: unknown, target: { subagentId: string | null }) => {
    targets.push({ harness, target })
    return reads.readHistory(harness, target)
  }
  // A Subagent observes its parent too, so both chains read.
  const child = await observe({ readHistory }, codexId, 'child-thread')
  await reads.chain(null).answer([message('m1', 'user', 'Check the build')])
  await reads.chain('child-thread').answer([message('c1', 'assistant', 'Child result')])
  expect(new Set(targets.map((target) => JSON.stringify(target)))).toEqual(
    new Set(
      [null, 'child-thread'].map((subagentId) =>
        JSON.stringify({
          harness: 'codex',
          target: { nativeId: 'root-thread', subagentId, cwd: '/work/project' },
        }),
      ),
    ),
  )
  child.subscription.unsubscribe()
})

test('a Subagent chain reads its own history through the same Observe and Refresh', async () => {
  const reads = chainReads()
  const child = await observe({ readHistory: reads.readHistory }, sessionId, 'agent-1')
  await reads.chain(null).answer([delegation('call-1', 'started')])
  await reads.chain('agent-1').answer([message('c1', 'assistant', 'Reading the adapters')])
  expect(child.latest()).toMatchObject({ sessionId, chainId: 'agent-1', state: 'ready' })
  expect(rowIds(child.latest())).toEqual(['c1'])
  await expect(
    child.caller.sessionFeedRefresh({ sessionId, subagentId: 'agent-1' }),
  ).resolves.toEqual({ accepted: true })
  await reads.chain('agent-1').answer([message('c1', 'assistant', 'Done reading')])
  expect(child.latest()?.entries[0]?.row).toMatchObject({ text: 'Done reading' })
  child.subscription.unsubscribe()
})

test('the parent lists its Subagents, and a response ends the Subagent Feed once', async () => {
  const reads = chainReads()
  const parent = await observe({ readHistory: reads.readHistory })
  const child = await also(parent, 'agent-1')
  const started = delegation('call-1', 'started', { prompt: 'Survey the adapters' })
  await reads.chain(null).answer([started])
  await reads.chain('agent-1').answer([message('c1', 'assistant', 'Two adapters')])
  expect(parent.latest()?.subagents).toEqual([
    { id: 'agent-1', label: 'Survey adapters', state: 'running' },
  ])
  expect(rowIds(child.latest())).toEqual(['c1'])

  // The parent's history now records the response; the child reads its settled transcript.
  await parent.caller.sessionFeedRefresh({ sessionId })
  const response = delegation('call-1:response', 'responded', {
    status: 'completed',
    summary: 'Two adapters',
  })
  await reads.chain(null).answer([started, response])
  await reads.chain('agent-1').answer([message('c1', 'assistant', 'Two adapters')])
  expect(parent.latest()?.subagents).toEqual([
    { id: 'agent-1', label: 'Survey adapters', state: 'completed' },
  ])
  expect(child.latest()?.entries.map(({ row }) => row)).toEqual([
    { shape: 'prose', id: 'c1', role: 'assistant', text: 'Two adapters' },
    {
      shape: 'subagent',
      id: 'call-1:response',
      subagentId: 'agent-1',
      event: 'responded',
      state: 'completed',
      name: 'Survey adapters',
    },
  ])
  // Another parent read with the same response publishes nothing new to the child.
  const before = child.readings.length
  await parent.caller.sessionFeedRefresh({ sessionId })
  await reads.chain(null).answer([started, response])
  expect(child.readings).toHaveLength(before)
  expect(parent.latest()?.entries.map(({ row }) => row.id)).toEqual(['call-1', 'call-1:response'])
  child.subscription.unsubscribe()
  parent.subscription.unsubscribe()
})

test('a failed Subagent ends its Feed as failed', async () => {
  const reads = chainReads()
  const child = await observe({ readHistory: reads.readHistory }, sessionId, 'agent-1')
  await reads
    .chain(null)
    .answer([
      delegation('call-1', 'started'),
      delegation('call-1:response', 'responded', { status: 'failed' }),
    ])
  await reads.chain('agent-1').answer([])
  expect(child.latest()?.entries.at(-1)?.row).toMatchObject({
    shape: 'subagent',
    event: 'responded',
    state: 'failed',
  })
  child.subscription.unsubscribe()
})

test('a live Subagent event reconciles with the parent history once', async () => {
  const reads = chainReads()
  const parent = await observe({ readHistory: reads.readHistory })
  const started = delegation('call-1', 'started')
  const messaged = delegation('call-1:message', 'messaged', { prompt: 'Also tests' })
  journal.append(sessionId, content(started))
  journal.append(sessionId, content(messaged))
  await reads.chain(null).answer([started])
  expect(rowIds(parent.latest())).toEqual(['call-1', 'call-1:message'])
  parent.subscription.unsubscribe()
})

test('a Subagent follows its own history file even while the parent is live', async () => {
  const reads = chainReads()
  const followed: (string | null)[] = []
  const child = await observe(
    {
      readHistory: reads.readHistory,
      followHistory: (target) => {
        followed.push(target.target.subagentId)
        return () => {}
      },
    },
    sessionId,
    'agent-1',
  )
  expect(followed).toEqual(['agent-1'])
  child.subscription.unsubscribe()
})
