import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import type { SessionSkillRead, SessionSkillRequest } from './skill-contract'

const SKILL_FILE = 'SKILL.md'

// The renderer names the path, so only a skill's own file is readable: an absolute path to a
// `SKILL.md` that is still a `SKILL.md` once its links resolve.
async function skillFile(requested: string) {
  if (!path.isAbsolute(requested) || path.basename(requested) !== SKILL_FILE) return null
  const resolved = await realpath(requested).catch(() => null)
  return resolved !== null && path.basename(resolved) === SKILL_FILE ? resolved : null
}

export async function readSkillFile(request: SessionSkillRequest): Promise<SessionSkillRead> {
  const file = await skillFile(request.path)
  const content = file === null ? null : await readFile(file, 'utf8').catch(() => null)
  return { version: 1, type: 'session.skill.read', requestId: request.requestId, content }
}
