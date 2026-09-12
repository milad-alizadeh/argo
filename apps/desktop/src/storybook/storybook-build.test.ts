import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseImporters, parseStories } from './storybook-build'

const entry = (type: string, name: string) => ({
  type,
  id: `sessions-sessionfeed--${name.toLowerCase()}`,
  name,
  title: 'Sessions/SessionFeed',
  importPath: './src/renderer/modules/sessions/components/SessionFeed.stories.tsx',
})

test('a docs entry is not a story', () => {
  const index = { entries: { docs: entry('docs', 'Docs'), default: entry('story', 'Default') } }
  assert.deepEqual(
    parseStories(JSON.stringify(index), 'built index').map((story) => story.name),
    ['Default'],
  )
})

test('a malformed manifest is rejected with its source', () => {
  const cases: [string, RegExp][] = [
    ['{', /built index: invalid JSON/],
    [
      JSON.stringify({ entries: { broken: { type: 'story', id: 'broken' } } }),
      /built index: story entry broken is missing id, name, title, or importPath/,
    ],
  ]
  for (const [text, error] of cases) assert.throws(() => parseStories(text, 'built index'), error)
})

test('a malformed import graph is rejected with its source', () => {
  const cases: [string, RegExp][] = [
    ['{}', /built stats: expected an object/],
    [
      JSON.stringify({ modules: [{ id: 'a', reasons: [{}] }] }),
      /built stats: module a has a reason without a moduleName/,
    ],
  ]
  for (const [text, error] of cases) assert.throws(() => parseImporters(text, 'built stats'), error)
})
