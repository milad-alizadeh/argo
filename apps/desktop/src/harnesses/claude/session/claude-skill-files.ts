import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type ClaudeSkillFile = (name: string) => string | null

const SKILL_NAME = /^[\w-][\w.-]*$/

// The start folder and each parent up to the repo root, root first; only the start folder outside a repo.
function projectFolders(cwd: string): string[] {
  const folders: string[] = []
  for (let folder = cwd; ; folder = path.dirname(folder)) {
    folders.push(folder)
    if (existsSync(path.join(folder, '.git'))) return folders.reverse()
    if (path.dirname(folder) === folder) return [cwd]
  }
}

// Claude Code's lookup: personal skills win over project ones, and a repo-root skill over a nested one.
export function claudeSkillFiles(cwd: string | null, home = os.homedir()): ClaudeSkillFile {
  const folders = [home, ...(cwd === null ? [] : projectFolders(cwd))]
  return (name) => {
    if (!SKILL_NAME.test(name)) return null
    for (const folder of folders) {
      const file = path.join(folder, '.claude', 'skills', name, 'SKILL.md')
      if (existsSync(file)) return file
    }
    return null
  }
}
