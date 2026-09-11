// The pull-request half of #1910. Storybook is hosted from `main`, so a pull request cannot be
// given a preview of its own build; what it can be given is a deep link to every story whose
// component the diff touches, which is where a reviewer looks at the pixels.
//
// The link set is read out of `index.json`, the manifest `storybook build` writes beside the site.
// A story id is stable (it is derived from the story's title and export name), so a link computed
// from a pull-request build resolves on the deployed one when that story already exists on main.
// New stories are named without a link until the next main deployment contains them.
//
// Usage: node scripts/storybook-story-links.mjs --index <index.json> --deployed-index <index.json> \
//          --base <site url> \
//          --changed <file of newline-separated repository-relative paths>
import { readFile } from 'node:fs/promises'
import process from 'node:process'

function option(name) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? null : (process.argv[at + 1] ?? null)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseIndex(text, source) {
  let value
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new Error(`${source}: invalid JSON (${error.message})`)
  }
  if (!isRecord(value) || !isRecord(value.entries)) {
    throw new Error(`${source}: expected an object with an entries object`)
  }
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!isRecord(entry) || typeof entry.type !== 'string') {
      throw new Error(`${source}: entry ${key} must have an object value with a type`)
    }
    if (
      entry.type === 'story' &&
      (typeof entry.id !== 'string' ||
        typeof entry.name !== 'string' ||
        typeof entry.title !== 'string' ||
        typeof entry.importPath !== 'string')
    ) {
      throw new Error(`${source}: story entry ${key} is missing id, name, title, or importPath`)
    }
  }
  return value
}

// Both sides of the comparison lose their extension and any leading `./` or `../`: `importPath` is
// written relative to Storybook's own root and a changed path is relative to the repository root,
// so only the tail they share can be matched.
function normalize(filePath) {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^(?:\.\.?\/)+/, '')
    .replace(/\.(?:tsx|ts|jsx|js)$/, '')
}

// A story covers a changed file when the file is the story itself or the component beside it. The
// rule is deliberately narrow: a component reached only through an import chain is not claimed,
// because a link that promises to show a change and does not is worse than no link.
function covers(storyPath, changed) {
  const story = normalize(storyPath)
  const component = story.replace(/\.stories$/, '')
  return changed.some((file) => {
    const candidate = normalize(file)
    return (
      candidate === story ||
      candidate === component ||
      candidate.endsWith(`/${story}`) ||
      candidate.endsWith(`/${component}`)
    )
  })
}

function storiesFor(index, changed) {
  const grouped = new Map()
  for (const entry of Object.values(index.entries ?? {})) {
    if (entry.type !== 'story') continue
    if (!covers(entry.importPath ?? '', changed)) continue
    const stories = grouped.get(entry.title) ?? []
    stories.push({ id: entry.id, name: entry.name })
    grouped.set(entry.title, stories)
  }
  return grouped
}

export function comment(index, changed, { base, deployedIndex = index }) {
  const grouped = storiesFor(index, changed)
  if (grouped.size === 0) return ''
  const site = base.replace(/\/$/, '')
  const deployedStories = new Set(
    Object.values(deployedIndex.entries ?? {})
      .filter((entry) => entry.type === 'story')
      .map((entry) => entry.id),
  )
  const lines = [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([title, stories]) => {
      const links = stories
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((story) =>
          deployedStories.has(story.id)
            ? `[${story.name}](${site}/?path=/story/${story.id})`
            : `\`${story.name}\` (available after merge)`,
        )
      return `- **${title}** — ${links.join(', ')}`
    })
  return [
    '## Storybook',
    '',
    `The site tracks \`main\`, at ${site}. Links below point to stories already deployed there;`,
    'new stories are named without a link until this pull request merges and deploys.',
    '',
    ...lines,
    '',
  ].join('\n')
}

// Guarded, so the test beside this file can import `comment` without the argument parsing below
// running and exiting the test process.
if (import.meta.main) {
  const indexPath = option('index')
  const deployedIndexPath = option('deployed-index')
  const base = option('base')
  const changedPath = option('changed')
  if (!indexPath || !deployedIndexPath || !base || !changedPath) {
    process.stderr.write(
      'usage: --index <index.json> --deployed-index <index.json> --base <site url> --changed <file>\n',
    )
    process.exit(2)
  }

  const changed = (await readFile(changedPath, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const index = parseIndex(await readFile(indexPath, 'utf8'), indexPath)
  const deployedIndex = parseIndex(await readFile(deployedIndexPath, 'utf8'), deployedIndexPath)
  process.stdout.write(comment(index, changed, { base, deployedIndex }))
}
