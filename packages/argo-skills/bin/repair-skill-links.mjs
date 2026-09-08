// `skills add` publishes the canonical payload in `.agents/skills/<name>`. When its agent list
// also includes that universal location, some releases leave `<name>/<name>` as a self-link.
// The relative target is then resolved from the canonical directory and points nowhere.

import { existsSync, lstatSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

function isSymbolicLink(path) {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

/**
 * Remove the installer-only self-links below canonical universal skills.
 *
 * @param {string} root project or linked-worktree root
 * @returns {string[]} repo-relative paths removed
 */
export function repairSkillLinks(root) {
  const skills = resolve(root, '.agents/skills')
  if (!existsSync(skills)) return []

  const repaired = []
  for (const name of readdirSync(skills)) {
    const canonical = resolve(skills, name)
    if (isSymbolicLink(canonical) || !existsSync(resolve(canonical, 'SKILL.md'))) continue
    const redundant = resolve(canonical, name)
    if (!isSymbolicLink(redundant)) continue
    unlinkSync(redundant)
    repaired.push(`.agents/skills/${name}/${name}`)
  }
  return repaired
}
