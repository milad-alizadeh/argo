// The IO and printing every check shares: one walk, one reader, one row shape.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', 'worktrees', '.build', 'build', 'dist', '.next'])

export const walk = (directory, out = []) => {
  if (!existsSync(directory)) return out
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = path.join(directory, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}
export const read = (file) => readFileSync(file, 'utf8')
export const size = (file) => statSync(file).size
export const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`
export const section = (title) => console.log(`\n## ${title}\n`)
export const row = (...cells) => console.log(cells.join('  '))
export const relativeTo = (root) => (file) =>
  file.startsWith(root) ? path.relative(root, file) : file.replace(homedir(), '~')
export const markdownUnder = (directory) => walk(directory).filter((file) => file.endsWith('.md'))
