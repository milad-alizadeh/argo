import { expect, test } from 'bun:test'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest } from '../app-server/codex-app-server-client'
import { CodexSubagentPairing } from './codex-subagent-content'

const STARTED = {
  type: 'subAgentActivity',
  id: 'call_spawn',
  kind: 'started',
  agentThreadId: 'thread-child',
  agentPath: '/root/spec_review',
} as const

function deferredThreadRead() {
  let answer: (value: unknown) => void = () => {}
  const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse(await new Promise((resolve) => (answer = resolve)))) as CodexRequest
  return { request, answer: (value: unknown) => answer(value) }
}

test('draws an activity at once and again with the nickname its thread carries', async () => {
  const { request, answer } = deferredThreadRead()
  const redraws: FeedContent[] = []
  const pairing = new CodexSubagentPairing(request)
  expect(pairing.activity(STARTED, (content) => redraws.push(content))).not.toHaveProperty(
    'nickname',
  )
  answer({ thread: { agentNickname: 'Jason' } })
  await new Promise((resolve) => setImmediate(resolve))
  expect(redraws).toEqual([expect.objectContaining({ id: 'call_spawn', nickname: 'Jason' })])
})

test('still redraws an activity whose nickname lands after its turn was cleared', async () => {
  const { request, answer } = deferredThreadRead()
  const redraws: FeedContent[] = []
  const pairing = new CodexSubagentPairing(request)
  pairing.activity({ ...STARTED, agentThreadId: 'thread-late' }, (content) => redraws.push(content))
  pairing.clear()
  answer({ thread: { agentNickname: 'Jason' } })
  await new Promise((resolve) => setImmediate(resolve))
  expect(redraws).toEqual([expect.objectContaining({ agentId: 'thread-late', nickname: 'Jason' })])
})

test('reports a thread read of an unknown shape and draws no nickname', async () => {
  const warning = console.warn
  const warnings: unknown[] = []
  console.warn = (message: unknown) => warnings.push(message)
  const { request, answer } = deferredThreadRead()
  const redraws: FeedContent[] = []
  new CodexSubagentPairing(request).activity(
    { ...STARTED, agentThreadId: 'thread-odd' },
    (content) => redraws.push(content),
  )
  answer({ thread: { agentNickname: 7 } })
  await new Promise((resolve) => setImmediate(resolve))
  console.warn = warning
  expect(redraws).toEqual([])
  expect(warnings).toEqual(['Rejected 1 unsupported Codex Subagent thread shape.'])
})
