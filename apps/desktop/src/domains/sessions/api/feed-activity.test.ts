import { expect, test } from 'bun:test'
import { advanceFeedActivity, EMPTY_FEED_ACTIVITY, settleFeedActivity } from './feed-activity'
import type { FeedContent } from './feed-content'

test('Claude tool work yields to newer reasoning and ignores its later result', () => {
  const started: FeedContent = {
    kind: 'tool',
    id: 'tool-use',
    callId: 'call-1',
    name: 'Bash',
    status: 'running',
    input: { command: 'bun test' },
    output: null,
    summary: null,
    presentation: { kind: 'command', label: 'Run the Feed tests' },
  }
  const running = advanceFeedActivity(EMPTY_FEED_ACTIVITY, started)
  expect(running.activity).toMatchObject({
    label: 'Run the Feed tests',
    kind: 'command',
    open: true,
  })
  const thinking = advanceFeedActivity(running, {
    kind: 'reasoning',
    id: 'reason-1',
    text: 'Checking the results',
    redacted: false,
  })
  expect(thinking.activity).toMatchObject({ label: 'Checking the results', kind: 'thought' })
  const completed = advanceFeedActivity(thinking, {
    ...started,
    id: 'tool-result',
    status: 'completed',
    input: null,
    presentation: undefined,
  })
  expect(completed).toEqual(thinking)
})

test('Codex commentary becomes the latest activity and settles with the Turn', () => {
  const command: FeedContent = {
    kind: 'command',
    id: 'command-1',
    command: 'rg FeedContent',
    cwd: '/repo',
    status: 'running',
    output: null,
    stderr: null,
    exitCode: null,
  }
  const running = advanceFeedActivity(EMPTY_FEED_ACTIVITY, command)
  expect(running.activity).toMatchObject({ kind: 'command', open: true })
  const commentary = advanceFeedActivity(running, {
    kind: 'message',
    id: 'commentary-1',
    role: 'assistant',
    text: 'Reading the contract',
    phase: 'commentary',
  })
  expect(commentary.activity).toMatchObject({
    kind: 'thought',
    label: 'Reading the contract',
    open: true,
  })
  expect(settleFeedActivity(commentary).activity?.open).toBe(false)
  expect(
    advanceFeedActivity(commentary, {
      kind: 'message',
      id: 'prompt-2',
      role: 'user',
      text: 'Next turn',
    }),
  ).toEqual(EMPTY_FEED_ACTIVITY)
})
