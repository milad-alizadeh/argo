// Which rule files cover a path. Read by rules-guard.mjs, which decides what to do about them;
// this file only reads the `paths:` frontmatter and answers with matches, so both halves stay
// testable on their own.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// A YAML block between the first two `---` lines, and only when the file opens with one.
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/

// One `- "glob"` item under a `paths:` key. Quotes are YAML's, not part of the glob.
const LIST_ITEM = /^\s*-\s*(.+?)\s*$/
const unquote = (value) => value.replace(/^['"]|['"]$/g, '')

/**
 * The globs a rule file declares. An empty list is the honest answer for a file with no
 * frontmatter, no `paths:` key, or an empty one: such a file covers nothing and is never
 * surfaced.
 * @param {string} text
 * @returns {string[]}
 */
export function ruleGlobs(text) {
  const block = FRONTMATTER.exec(text)
  if (!block) return []
  const globs = []
  let inPaths = false
  for (const line of block[1].split(/\r?\n/)) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true
      continue
    }
    // Any other key at column zero ends the list.
    if (/^\S/.test(line)) {
      inPaths = false
      continue
    }
    const item = inPaths && LIST_ITEM.exec(line)
    if (item) globs.push(unquote(item[1]))
  }
  return globs
}

// `?` is escaped rather than translated: no rule uses it, and left unescaped it reaches the
// pattern as a quantifier, so `a/x?.ts` would widen to cover `a/.ts`.
const ESCAPE = /[.+^${}()|[\]\\?]/g

/**
 * A glob as a full-string regular expression. `**` crosses directory separators and `*` does
 * not, and `**\/` also matches nothing at all, so `a/**\/*.swift` covers `a/x.swift`.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let source = ''
  for (let i = 0; i < glob.length; i += 1) {
    const rest = glob.slice(i)
    if (rest.startsWith('**/')) {
      source += '(?:[^/]+/)*'
      i += 2
    } else if (rest.startsWith('**')) {
      source += '.*'
      i += 1
    } else if (glob[i] === '*') {
      source += '[^/]*'
    } else {
      source += glob[i].replace(ESCAPE, '\\$&')
    }
  }
  return new RegExp(`^${source}$`)
}

/**
 * Whether a repository-relative path is covered by a glob. Separators are normalised, so this
 * answers the same on a Windows-shaped path as on a POSIX one.
 * @param {string} glob
 * @param {string} relativePath
 * @returns {boolean}
 */
export const covers = (glob, relativePath) =>
  globToRegExp(glob).test(relativePath.split(path.sep).join('/'))

/**
 * Every rule file in a directory, with the globs it declares. Sorted by name so a session that
 * touches two rules is told about them in the same order every run. An unreadable directory
 * reads as no rules, which leaves the guard silent rather than wedged.
 * @param {string} directory
 * @returns {Array<{ name: string, globs: string[] }>}
 */
export function readRules(directory) {
  let entries = []
  try {
    entries = readdirSync(directory)
      .filter((name) => name.endsWith('.md'))
      .sort()
  } catch {
    return []
  }
  const rules = []
  for (const name of entries) {
    try {
      const globs = ruleGlobs(readFileSync(path.join(directory, name), 'utf8'))
      if (globs.length) rules.push({ name, globs })
    } catch {
      // An unreadable rule file is one this guard cannot enforce. Say nothing about it.
    }
  }
  return rules
}

/**
 * The rule files that cover a path, by name.
 * @param {Array<{ name: string, globs: string[] }>} rules
 * @param {string} relativePath repository-relative, never absolute
 * @returns {string[]}
 */
export const rulesFor = (rules, relativePath) =>
  rules
    .filter((rule) => rule.globs.some((glob) => covers(glob, relativePath)))
    .map((rule) => rule.name)
