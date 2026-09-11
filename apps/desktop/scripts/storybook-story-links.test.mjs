// The pull-request comment is the only visual evidence a reviewer gets now that no gate writes a
// screenshot (#1910), so the matching rule it rests on is tested rather than trusted. What it has
// to get right: a component's own file, the story file beside it, a docs entry that is not a
// story, and a changed file no story covers.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { comment } from './storybook-story-links.mjs'

const story = (id, name, file) => ({
  type: 'story',
  id,
  name,
  title: `Sessions/${file}`,
  importPath: `./src/renderer/modules/sessions/components/${file}.stories.tsx`,
})

const INDEX = {
  v: 5,
  entries: {
    'sessions-sessionfeed--default': story(
      'sessions-sessionfeed--default',
      'Default',
      'SessionFeed',
    ),
    'sessions-sessionfeed--empty': story('sessions-sessionfeed--empty', 'Empty', 'SessionFeed'),
    'sessions-sessionfeed--docs': {
      ...story('sessions-sessionfeed--docs', 'Docs', 'SessionFeed'),
      type: 'docs',
    },
    'sessions-sessionstatus--running': story(
      'sessions-sessionstatus--running',
      'Running',
      'SessionStatus',
    ),
  },
}

const SITE = 'https://milad-alizadeh.github.io/argo/'
const FEED = ['apps/desktop/src/renderer/modules/sessions/components/SessionFeed.tsx']

test('links every story of a changed component, and no other component', () => {
  const body = comment(INDEX, FEED, { base: SITE })
  assert.equal(
    body.includes(
      '[Default](https://milad-alizadeh.github.io/argo/?path=/story/sessions-sessionfeed--default)',
    ),
    true,
  )
  assert.equal(
    body.includes(
      '[Empty](https://milad-alizadeh.github.io/argo/?path=/story/sessions-sessionfeed--empty)',
    ),
    true,
  )
  assert.equal(body.includes('SessionStatus'), false)
})

test('a docs entry is not a story and carries no link', () => {
  assert.equal(comment(INDEX, FEED, { base: SITE }).includes('sessions-sessionfeed--docs'), false)
})

test('a changed story file counts as a change to its own component', () => {
  const changed = [
    'apps/desktop/src/renderer/modules/sessions/components/SessionStatus.stories.tsx',
  ]
  assert.equal(
    comment(INDEX, changed, { base: SITE }).includes('sessions-sessionstatus--running'),
    true,
  )
})

test('a story missing from the deployed site is named without a dead link', () => {
  const deployed = {
    entries: {
      'sessions-sessionfeed--default': INDEX.entries['sessions-sessionfeed--default'],
    },
  }
  const body = comment(INDEX, FEED, { base: SITE, deployedIndex: deployed })
  assert.equal(
    body.includes(
      '[Default](https://milad-alizadeh.github.io/argo/?path=/story/sessions-sessionfeed--default)',
    ),
    true,
  )
  assert.equal(body.includes('`Empty` (available after merge)'), true)
  assert.equal(body.includes('/story/sessions-sessionfeed--empty'), false)
})

test('a file no story covers produces no comment at all', () => {
  assert.equal(comment(INDEX, ['apps/desktop/src/core/appearance/bridge.ts'], { base: SITE }), '')
  assert.equal(comment(INDEX, [], { base: SITE }), '')
})
