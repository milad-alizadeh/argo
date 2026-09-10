// The shadcn primitive base, enforced (#1767). `components.json` records what the generator was
// told, not what the code imports: a component pasted from a Radix answer compiles, passes review,
// and only shows up later as focus or dismissal behaving differently in one place.
//
// The base is read from `components.json`, and the folder it guards is read from the same file's
// components alias through the tsconfig that declares it. Switching base moves one value.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

// Every primitive library shadcn generates against. The style's leading word picks one; importing
// any of the others under the components alias is the breach.
export const PRIMITIVES = {
  base: '@base-ui/react',
  radix: 'radix-ui',
  aria: 'react-aria-components',
}

const SOURCE = /\.tsx?$/

// A tsconfig is JSON with comments, and this repository's carries them. Strings are matched first
// so a `//` inside a path value is kept rather than read as the start of a comment.
const STRING_OR_COMMENT = /"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g

export function stripComments(text) {
  return text.replace(STRING_OR_COMMENT, (match) => (match.startsWith('"') ? match : ''))
}

async function readJSON(file) {
  return JSON.parse(stripComments(await readFile(file, 'utf8')))
}

// `@/components` is only a spelling. The tsconfig turns it into a folder, and that is the file the
// shadcn generator reads too, so the guard and the generator cannot disagree about where
// components live.
function resolveAlias(alias, paths) {
  for (const [pattern, targets] of Object.entries(paths ?? {})) {
    const prefix = pattern.replace(/\*$/, '')
    const target = targets[0]
    if (!target || !alias.startsWith(prefix)) continue
    return path.normalize(target.replace(/\*$/, '') + alias.slice(prefix.length))
  }
  throw new Error(`no tsconfig path maps the components alias ${alias}`)
}

async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const found = []
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...(await sources(full)))
    else if (SOURCE.test(entry.name)) found.push(full)
  }
  return found.sort()
}

// Static imports, type-only imports, re-exports and `require` all name their module in quotes.
// Reading the quoted names is enough here: a component reaching a second primitive library does it
// by importing it, not by computing its name.
function specifiers(text) {
  return [...text.matchAll(/(?:from|import|require\()\s*['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  )
}

export async function checkComponentBase(root) {
  const config = await readJSON(path.join(root, 'components.json'))
  const style = String(config.style ?? '')
  const base = style.split('-')[0]
  const allowed = PRIMITIVES[base]
  if (!allowed) {
    throw new Error(`components.json style "${style}" names no known primitive base`)
  }
  const tsconfig = await readJSON(path.join(root, 'tsconfig.json'))
  const alias = resolveAlias(config.aliases.components, tsconfig.compilerOptions?.paths)
  const directory = path.join(root, alias)
  const forbidden = Object.values(PRIMITIVES).filter((name) => name !== allowed)
  // A missing or empty components folder is a gate that read nothing and reported no breach, which
  // is the shape of a guard that has quietly stopped guarding. It is refused rather than passed.
  const files = await sources(directory).catch(() => [])
  if (files.length === 0) {
    throw new Error(`${config.aliases.components} holds no component source at ${alias}`)
  }
  const breaches = []
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    for (const specifier of specifiers(text)) {
      const hit = forbidden.find((name) => specifier === name || specifier.startsWith(`${name}/`))
      if (hit) breaches.push({ file: path.relative(root, file), specifier: hit })
    }
  }
  return { base, allowed, directory, files: files.length, breaches }
}
