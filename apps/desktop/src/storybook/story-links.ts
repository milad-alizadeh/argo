// Writes the Storybook section of a pull request body (#1953); `storybook-links.yml` runs it.
import { readFile } from 'node:fs/promises'
import { posix } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import {
  type Importers,
  parseImporters,
  parseStories,
  type Story,
  type StorybookBuild,
} from './storybook-build'

export type Preview = { url: string; sha: string }

// Every open pull request body already holds these, so a new spelling strands their sections.
const START = '<!-- storybook-links:start -->'
const END = '<!-- storybook-links:end -->'
const SEPARATOR = '\n\n'
const STORYBOOK_PREVIEW_FILE = /^\.storybook\/preview\.[jt]sx?$/

// A CSS file pulled in by `@import` is inlined by the CSS pipeline and is not a module, so a
// change to `tokens.css` reaches no story (#1954).
function affected(importers: Importers, changed: string[]): Set<string> {
  const reached = new Set(changed.filter((path) => importers.has(path)))
  const queue = [...reached]
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    for (const importer of importers.get(path) ?? []) {
      if (reached.has(importer)) continue
      reached.add(importer)
      queue.push(importer)
    }
  }
  return reached
}

// `changed` is relative to the Storybook root, like every path in the build.
export function section(
  { stories, importers }: StorybookBuild,
  changed: string[],
  { url, sha }: Preview,
): string {
  const reached = affected(importers, changed)
  const everyStory = [...reached].some((path) => STORYBOOK_PREVIEW_FILE.test(path))
  const grouped = new Map<string, Story[]>()
  for (const story of stories) {
    if (!everyStory && !reached.has(story.importPath)) continue
    grouped.set(story.title, [...(grouped.get(story.title) ?? []), story])
  }
  if (grouped.size === 0) return ''
  const site = url.replace(/\/$/, '')
  const lines = [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([title, group]) => {
      const links = group
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((story) => `[${story.name}](${site}/?path=/story/${story.id})`)
      return `- ${title}: ${links.join(', ')}`
    })
  const scope = everyStory
    ? 'This pull request changed a file that `.storybook/preview` loads, so every story is listed.'
    : 'These stories render a file that this pull request changed.'
  const opens = `They open on the [preview](${site}) of \`${sha.slice(0, 7)}\`.`
  return ['## Storybook', '', `${scope} ${opens}`, '', ...lines].join('\n')
}

function markers(body: string): { start: number; end: number } | null {
  const count = (marker: string) => body.split(marker).length - 1
  if (count(START) === 0 && count(END) === 0) return null
  const start = body.indexOf(START)
  const end = body.indexOf(END)
  if (count(START) !== 1 || count(END) !== 1 || end < start) {
    throw new Error(`the body must hold one ${START} and, after it, one ${END}`)
  }
  return { start, end: end + END.length }
}

// Everything outside the markers is the author's and is kept byte for byte: removing a section
// takes back only the separator that appending it added.
export function withSection(body: string, content: string): string {
  const block = content === '' ? '' : `${START}\n${content}\n${END}`
  const found = markers(body)
  if (found === null) {
    if (block === '') return body
    return body === '' ? block : `${body}${SEPARATOR}${block}`
  }
  const before = body.slice(0, found.start)
  const after = body.slice(found.end)
  if (block !== '') return `${before}${block}${after}`
  return `${before.endsWith(SEPARATOR) ? before.slice(0, -SEPARATOR.length) : before}${after}`
}

if (import.meta.main) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries(
      ['index', 'stats', 'root', 'changed', 'preview', 'sha', 'body', 'section'].map((name) => [
        name,
        { type: 'string' as const },
      ]),
    ),
  })
  const option = (name: string): string => {
    const value = values[name]
    if (typeof value === 'string' && value !== '') return value
    process.stderr.write(`missing --${name}\n`)
    process.exit(2)
  }
  const read = (name: string) => readFile(option(name), 'utf8')
  switch (positionals[0]) {
    case 'section': {
      const build = {
        stories: parseStories(await read('index'), option('index')),
        importers: parseImporters(await read('stats'), option('stats')),
      }
      const changed = (await read('changed'))
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => posix.relative(option('root'), line.trim()))
      process.stdout.write(section(build, changed, { url: option('preview'), sha: option('sha') }))
      break
    }
    case 'body':
      process.stdout.write(withSection(await read('body'), (await read('section')).trim()))
      break
    default:
      process.stderr.write('usage: story-links.ts section|body [options]\n')
      process.exit(2)
  }
}
