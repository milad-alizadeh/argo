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

test('a running thought reads once, as the trailing row', () => {
  const history: FeedContent[] = [
    prompt,
    command('c1', 'bun test', 'completed'),
    { kind: 'reasoning', id: 'r1', text: 'Reading the failure', redacted: false },
  ]
  const rows = rowsOf(history, true)
  expect(rows.at(-1)).toEqual({ shape: 'thought', id: 'activity', text: 'Reading the failure' })
  const group = rows.at(-2)
  expect(group?.shape === 'tool-group' && (group.thoughts ?? [])).toEqual([])
})

test('an activity with no group of its own leaves the rows alone', () => {
  const rows = rowsOf([prompt], true)
  expect(rows).toEqual([{ shape: 'prose', id: 'm1', role: 'user', text: 'Check the build' }])
})
