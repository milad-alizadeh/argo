import { expect, test } from 'bun:test'
import type { FeedContent } from '../feed-content'
import { feedReadingRows } from './feed-reading-rows'
import { projectFeedRowEntries } from './feed-row-entries'

function command(id: string, text: string, status: 'running' | 'completed'): FeedContent {
  return {
    kind: 'command',
    id,
    command: text,
    cwd: null,
    status,
    output: null,
    stderr: null,
    exitCode: null,
  }
}

const prompt: FeedContent = { kind: 'message', id: 'm1', role: 'user', text: 'Check the build' }

function rowsOf(history: FeedContent[], running: boolean) {
  return feedReadingRows(projectFeedRowEntries({ history, live: [] }).entries, { running })
}

test('a running Turn titles its tail group with the current activity', () => {
  const rows = rowsOf([prompt, command('c1', 'bun test', 'running')], true)
  expect(rows.at(-1)).toMatchObject({
    shape: 'tool-group',
    headline: { kind: 'command', label: 'Ran bun test', open: true },
  })
})

test('a settled Turn draws no headline and no activity row', () => {
  const rows = rowsOf([prompt, command('c1', 'bun test', 'completed')], false)
  expect(rows.at(-1)).toMatchObject({ shape: 'tool-group' })
  expect(rows.at(-1)).not.toHaveProperty('headline')
  expect(rows.some((row) => row.shape === 'thought')).toBe(false)
})

test('running Codex commentary titles the latest expandable group until the Turn settles', () => {
  const history: FeedContent[] = [
    prompt,
    command('c1', 'bun test', 'completed'),
    {
      kind: 'message',
      id: 'commentary-1',
      role: 'assistant',
      phase: 'commentary',
      text: 'Reading the failure',
    },
  ]
  const running = rowsOf(history, true)
  expect(running.at(-1)).toMatchObject({
    shape: 'tool-group',
    headline: { kind: 'thought', label: 'Reading the failure' },
    calls: [{ id: 'c1' }],
  })
  expect(running.some((row) => row.shape === 'thought')).toBe(false)
  const group = running.at(-1)
  expect(group?.shape === 'tool-group' && (group.thoughts ?? [])).toEqual([])

  const settled = rowsOf(history, false)
  const settledGroup = settled.at(-1)
  expect(settledGroup).toMatchObject({ shape: 'tool-group', label: 'Ran a command' })
  expect(settledGroup).not.toHaveProperty('headline')
  expect(settledGroup?.shape === 'tool-group' && settledGroup.thoughts).toEqual([
    { id: 'commentary-1', text: 'Reading the failure', afterCallIndex: 0 },
  ])
})

test('running commentary without a group remains a separate thought row', () => {
  const rows = rowsOf(
    [
      prompt,
      {
        kind: 'message',
        id: 'commentary-1',
        role: 'assistant',
        phase: 'commentary',
        text: 'Planning the work',
      },
    ],
    true,
  )
  expect(rows.at(-1)).toMatchObject({ shape: 'thought', text: 'Planning the work' })
})

test('an activity with no group of its own leaves the rows alone', () => {
  const rows = rowsOf([prompt], true)
  expect(rows).toEqual([{ shape: 'prose', id: 'm1', role: 'user', text: 'Check the build' }])
})
