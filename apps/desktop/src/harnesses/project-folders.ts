import { existsSync } from 'node:fs'
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
