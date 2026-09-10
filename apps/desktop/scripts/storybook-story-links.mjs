// The pull-request half of #1910. Storybook is hosted from `main`, so a pull request cannot be
// given a preview of its own build; what it can be given is a deep link to every story whose
// component the diff touches, which is where a reviewer looks at the pixels.
//
// The link set is read out of `index.json`, the manifest `storybook build` writes beside the site.
// A story id is stable (it is derived from the story's title and export name), so a link computed
// from a pull-request build still resolves on the deployed one. It resolves to nothing only when
// the story is brand new, and that is the one case a reader can diagnose from the link itself.
//
// Usage: node scripts/storybook-story-links.mjs --index <index.json> --base <site url> \
//          --changed <file of newline-separated repository-relative paths>
import { readFile } from 'node:fs/promises'
import process from 'node:process'

function option(name) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? null : (process.argv[at + 1] ?? null)
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

export function comment(index, changed, base) {
  const grouped = storiesFor(index, changed)
  if (grouped.size === 0) return ''
  const site = base.replace(/\/$/, '')
  const lines = [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([title, stories]) => {
      const links = stories
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((story) => `[${story.name}](${site}/?path=/story/${story.id})`)
      return `- **${title}** — ${links.join(', ')}`
    })
  return [
    '## Storybook',
    '',
    `The site tracks \`main\`, at ${site}. These stories cover the components this pull request`,
    'touches, so a state this pull request adds appears there after it merges.',
    '',
    ...lines,
    '',
  ].join('\n')
}

// Guarded, so the test beside this file can import `comment` without the argument parsing below
// running and exiting the test process.
if (import.meta.main) {
  const indexPath = option('index')
  const base = option('base')
  const changedPath = option('changed')
  if (!indexPath || !base || !changedPath) {
    process.stderr.write('usage: --index <index.json> --base <site url> --changed <file>\n')
    process.exit(2)
  }

  const changed = (await readFile(changedPath, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const index = JSON.parse(await readFile(indexPath, 'utf8'))
  process.stdout.write(comment(index, changed, base))
}
