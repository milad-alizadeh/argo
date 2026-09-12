// Links a pull request to every story that renders a file it changed, on the Vercel preview of its
// own commit (#1953). `storybook-links.yml` runs it; the preview sits behind Vercel login, so the
// stories and the import graph come from a local build rather than the deployed one.
//
// Usage: bun src/storybook/story-links.ts section --index <index.json> \
//          --stats <preview-stats.json> --base <preview url> --sha <commit> \
//          --changed <file of repository-relative paths>
//        bun src/storybook/story-links.ts body --body <pull request body> --section <section>
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { parseArgs } from 'node:util'
import {
  type Importers,
  normalize,
  parseImporters,
  parseStories,
  type Story,
  type StorybookBuild,
} from './storybook-build'

const START = '<!-- storybook-links:start -->'
const END = '<!-- storybook-links:end -->'
const PREVIEW = /^\.storybook\/preview\.[jt]sx?$/

// A CSS file pulled in by `@import` is inlined by the CSS pipeline and is not a module, so a
// change to `tokens.css` reaches no story.
function affected(importers: Importers, changed: string[]): Set<string> {
  const reached = new Set(
    [...importers.keys()].filter((path) =>
      changed.some((file) => {
        const candidate = normalize(file)
        return candidate === path || candidate.endsWith(`/${path}`)
      }),
    ),
  )
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

export function section(
  { stories, importers }: StorybookBuild,
  changed: string[],
  { base, sha }: { base: string; sha: string },
): string {
  const reached = affected(importers, changed)
  const everyStory = [...reached].some((path) => PREVIEW.test(path))
  const grouped = new Map<string, Story[]>()
  for (const story of stories) {
    if (!everyStory && !reached.has(normalize(story.importPath))) continue
    grouped.set(story.title, [...(grouped.get(story.title) ?? []), story])
  }
  if (grouped.size === 0) return ''
  const site = base.replace(/\/$/, '')
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
  const preview = `They open on the [preview](${site}) of \`${sha.slice(0, 7)}\`.`
  return ['## Storybook', '', `${scope} ${preview}`, '', ...lines].join('\n')
}

// Everything outside the markers is the author's and is kept byte for byte. An empty section
// removes the block, so a pull request that stops touching a component loses its stale links.
export function withSection(body: string, content: string): string {
  const block = content === '' ? '' : `${START}\n${content}\n${END}`
  const start = body.indexOf(START)
  const end = body.indexOf(END, start)
  if (start !== -1 && end !== -1) {
    const before = body.slice(0, start)
    const after = body.slice(end + END.length)
    if (block !== '') return `${before}${block}${after}`
    return [before.trimEnd(), after.trim()].filter((part) => part !== '').join('\n\n')
  }
  if (block === '') return body
  return body.trim() === '' ? `${block}\n` : `${body.trimEnd()}\n\n${block}\n`
}

if (import.meta.main) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries(
      ['index', 'stats', 'base', 'sha', 'changed', 'body', 'section'].map((name) => [
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
        .map((line) => line.trim())
        .filter((line) => line !== '')
      process.stdout.write(section(build, changed, { base: option('base'), sha: option('sha') }))
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
