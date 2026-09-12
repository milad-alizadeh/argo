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
  assert.throws(() => parseStories('{', 'built index'), /built index: invalid JSON/)
  assert.throws(
    () =>
      parseStories(
        JSON.stringify({ entries: { broken: { type: 'story', id: 'broken' } } }),
        'built index',
      ),
    /built index: story entry broken is missing id, name, title, or importPath/,
  )
})

test('a malformed import graph is rejected with its source', () => {
  assert.throws(() => parseImporters('{}', 'built stats'), /built stats: expected an object/)
  assert.throws(
    () => parseImporters(JSON.stringify({ modules: [{ id: 'a', reasons: [{}] }] }), 'built stats'),
    /built stats: module a has a reason without a moduleName/,
  )
})
