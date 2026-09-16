import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

const SKILL_FILE = 'SKILL.md'

// The renderer names the path, so only a skill's own file is readable: an absolute path to a
// `SKILL.md` that is still a `SKILL.md` once its links resolve.
async function skillFile(requested: string) {
  if (!path.isAbsolute(requested) || path.basename(requested) !== SKILL_FILE) return null
  const resolved = await realpath(requested).catch(() => null)
  return resolved !== null && path.basename(resolved) === SKILL_FILE ? resolved : null
}

export async function skillFileContent(requested: string): Promise<string | null> {
  const file = await skillFile(requested)
  return file === null ? null : await readFile(file, 'utf8').catch(() => null)
}
