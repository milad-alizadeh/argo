import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// The start folder and each parent up to the repo root, root first; only the start folder outside a repo.
export function projectFolders(cwd: string): string[] {
  const folders: string[] = []
  for (let folder = cwd; ; folder = path.dirname(folder)) {
    folders.push(folder)
    if (existsSync(path.join(folder, '.git'))) return folders.reverse()
    if (path.dirname(folder) === folder) return [cwd]
  }
}

// A linked worktree's `.git` file points at `<main>/.git/worktrees/<name>`. Skills live on the main checkout.
export function linkedWorktreeMain(repoRoot: string): string | null {
  let gitdir: string
  try {
    const match = readFileSync(path.join(repoRoot, '.git'), 'utf8').match(/^gitdir:\s*(.+)\s*$/m)
    if (match?.[1] === undefined) return null
    gitdir = path.resolve(repoRoot, match[1])
  } catch {
    return null
  }
  const marker = `${path.sep}.git${path.sep}worktrees${path.sep}`
  const index = gitdir.lastIndexOf(marker)
  if (index === -1) return null
  const main = gitdir.slice(0, index)
  return main === repoRoot ? null : main
}
