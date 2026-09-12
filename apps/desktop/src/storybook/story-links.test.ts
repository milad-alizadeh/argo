import assert from 'node:assert/strict'
import { test } from 'node:test'
import { section, withSection } from './story-links'
import { parseImporters, type Story } from './storybook-build'

const MODULES = './src/renderer/modules/sessions'
const story = (name: string, file: string, folder = 'components'): Story => ({
  id: `sessions-${file.toLowerCase()}--${name.toLowerCase()}`,
  name,
  title: `Sessions/${file}`,
  importPath: `${MODULES}/${folder}/${file}.stories.tsx`,
})

const STORIES = [
  story('Default', 'SessionFeed'),
  story('Empty', 'SessionFeed'),
  story('Running', 'SessionStatus'),
  story('Reading', 'SessionsScreenView', 'screens'),
]

// The shape `storybook build --stats-json` writes: each module names the modules importing it.
const built = (id: string, ...importers: string[]) => ({
  id,
  name: id,
  reasons: importers.map((moduleName) => ({ moduleName })),
})
const STORIES_ENTRY = '/virtual:/@storybook/builder-vite/storybook-stories.js'
const IMPORTERS = parseImporters(
  JSON.stringify({
    modules: [
      built(`${MODULES}/components/FeedDocument.tsx`, `${MODULES}/components/SessionFeed.tsx`),
      built(
        `${MODULES}/components/SessionFeed.tsx`,
        `${MODULES}/components/SessionFeed.stories.tsx`,
        `${MODULES}/screens/SessionsScreenView.tsx`,
      ),
      built(
        `${MODULES}/screens/SessionsScreenView.tsx`,
        `${MODULES}/screens/SessionsScreenView.stories.tsx`,
      ),
      built(
        `${MODULES}/components/SessionStatus.tsx`,
        `${MODULES}/components/SessionStatus.stories.tsx`,
      ),
      ...STORIES.map((entry) => built(entry.importPath, STORIES_ENTRY)),
      built('./src/renderer/styles/globals.css', './.storybook/preview.ts'),
    ],
  }),
  'built stats',
)
const BUILD = { stories: STORIES, importers: IMPORTERS }
const PREVIEW = { base: 'https://argo-storybook-abc.vercel.app/', sha: '0123456789abcdef' }
const START = '<!-- storybook-links:start -->'
const END = '<!-- storybook-links:end -->'

const linked = (changed: string[]) =>
  [...section(BUILD, changed, PREVIEW).matchAll(/\/story\/([\w-]+)\)/g)].map((match) => match[1])

test('links every story that renders a changed component to the preview, and no other', () => {
  const changed = ['apps/desktop/src/renderer/modules/sessions/components/SessionFeed.tsx']
  assert.deepEqual(linked(changed), [
    'sessions-sessionfeed--default',
    'sessions-sessionfeed--empty',
    'sessions-sessionsscreenview--reading',
  ])
  const content = section(BUILD, changed, PREVIEW)
  assert.ok(content.includes('(https://argo-storybook-abc.vercel.app/?path=/story/'))
  assert.ok(content.includes('`0123456`'))
})

test('a component with no story of its own links the stories that render it', () => {
  assert.deepEqual(
    linked(['apps/desktop/src/renderer/modules/sessions/components/FeedDocument.tsx']),
    [
      'sessions-sessionfeed--default',
      'sessions-sessionfeed--empty',
      'sessions-sessionsscreenview--reading',
    ],
  )
})

test('a changed story file links its own stories', () => {
  assert.deepEqual(
    linked(['apps/desktop/src/renderer/modules/sessions/components/SessionStatus.stories.tsx']),
    ['sessions-sessionstatus--running'],
  )
})

test('a file the Storybook preview loads lists every story, and says why', () => {
  const changed = ['apps/desktop/src/renderer/styles/globals.css']
  assert.equal(linked(changed).length, STORIES.length)
  assert.ok(section(BUILD, changed, PREVIEW).includes('every story is listed'))
})

test('a file no story renders produces no section', () => {
  assert.equal(section(BUILD, ['apps/desktop/src/core/appearance/bridge.ts'], PREVIEW), '')
  assert.equal(section(BUILD, [], PREVIEW), '')
})

test('the section is appended to a body that has none, after the author text', () => {
  assert.equal(
    withSection('Closes #1\n', '## Storybook'),
    `Closes #1\n\n${START}\n## Storybook\n${END}\n`,
  )
  assert.equal(withSection('', '## Storybook'), `${START}\n## Storybook\n${END}\n`)
})

test('a later run replaces its own section and keeps the author text around it', () => {
  const body = `Intro\n\n${START}\nold links\n${END}\n\nFooter`
  assert.equal(withSection(body, 'new links'), `Intro\n\n${START}\nnew links\n${END}\n\nFooter`)
})

test('an empty section removes the old one and leaves a body without one untouched', () => {
  assert.equal(withSection(`Intro\n\n${START}\nold\n${END}\n\nFooter`, ''), 'Intro\n\nFooter')
  assert.equal(withSection(`Intro\n\n${START}\nold\n${END}\n`, ''), 'Intro')
  assert.equal(withSection('Intro\n', ''), 'Intro\n')
})
