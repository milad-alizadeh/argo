import assert from 'node:assert/strict'
import { test } from 'node:test'
import { section, withSection } from './story-links'
import { parseImporters, type Story } from './storybook-build'

const MODULES = 'src/renderer/modules/sessions'
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
  id: `./${id}`,
  name: `./${id}`,
  reasons: importers.map((moduleName) => ({ moduleName: `./${moduleName}` })),
})
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
      ...STORIES.map((entry) => built(entry.importPath)),
      built('src/renderer/styles/globals.css', '.storybook/preview.ts'),
    ],
  }),
  'built stats',
)
const BUILD = { stories: STORIES, importers: IMPORTERS }
const PREVIEW = { url: 'https://argo-storybook-abc.vercel.app/', sha: '0123456789abcdef' }
const START = '<!-- storybook-links:start -->'
const END = '<!-- storybook-links:end -->'

const linked = (changed: string[]) =>
  [...section(BUILD, changed, PREVIEW).matchAll(/\/story\/([\w-]+)\)/g)].map((match) => match[1])

test('links every story that renders a changed component, and no other', () => {
  assert.deepEqual(linked([`${MODULES}/components/SessionFeed.tsx`]), [
    'sessions-sessionfeed--default',
    'sessions-sessionfeed--empty',
    'sessions-sessionsscreenview--reading',
  ])
})

test('a link opens its story on the preview and names the short commit', () => {
  const content = section(BUILD, [`${MODULES}/components/SessionStatus.tsx`], PREVIEW)
  assert.ok(
    content.includes(
      '[Running](https://argo-storybook-abc.vercel.app/?path=/story/sessions-sessionstatus--running)',
    ),
  )
  assert.ok(content.includes('`0123456`'))
})

test('a component with no story of its own links the stories that render it', () => {
  assert.deepEqual(linked([`${MODULES}/components/FeedDocument.tsx`]), [
    'sessions-sessionfeed--default',
    'sessions-sessionfeed--empty',
    'sessions-sessionsscreenview--reading',
  ])
})

test('a changed story file links its own stories', () => {
  assert.deepEqual(linked([`${MODULES}/components/SessionStatus.stories.tsx`]), [
    'sessions-sessionstatus--running',
  ])
})

test('a file the Storybook preview loads lists every story, and says why', () => {
  const changed = ['src/renderer/styles/globals.css']
  assert.equal(linked(changed).length, STORIES.length)
  assert.ok(section(BUILD, changed, PREVIEW).includes('every story is listed'))
})

test('a file no story renders produces no section', () => {
  const cases = [
    [],
    ['src/core/appearance/bridge.ts'],
    [`../../packages/other/${MODULES}/components/SessionFeed.tsx`],
  ]
  for (const changed of cases) assert.equal(section(BUILD, changed, PREVIEW), '')
})

test('the section is appended after the author text, which is kept byte for byte', () => {
  const block = `${START}\n## Storybook\n${END}`
  assert.equal(withSection('Closes #1\n', '## Storybook'), `Closes #1\n\n\n${block}`)
  assert.equal(withSection('', '## Storybook'), block)
})

test('a later run replaces its own section and keeps the author text around it', () => {
  const body = `Intro\n\n${START}\nold links\n${END}\n\nFooter`
  assert.equal(withSection(body, 'new links'), `Intro\n\n${START}\nnew links\n${END}\n\nFooter`)
})

test('removing a section restores the body it was appended to', () => {
  for (const body of ['', 'Intro', 'Intro\n', 'Intro\n\n']) {
    assert.equal(withSection(withSection(body, 'links'), ''), body)
  }
})

test('removing a section keeps the author text written after it', () => {
  assert.equal(withSection(`Intro\n\n${START}\nold\n${END}\n\nFooter`, ''), 'Intro\n\nFooter')
})

test('an empty section leaves a body without one untouched', () => {
  assert.equal(withSection('Intro\n', ''), 'Intro\n')
})

test('a body whose markers do not pair is refused rather than rewritten', () => {
  const cases = [`${START}\nold`, `old\n${END}`, `${END}\n${START}`, `${START}${START}\n${END}`]
  for (const body of cases) assert.throws(() => withSection(body, 'links'), /the body must hold/)
})
