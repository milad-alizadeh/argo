// Only the upstream's broken target is safe to remove.

import { existsSync, lstatSync, readdirSync, readlinkSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'

export const UNIVERSAL_SKILLS_DIR = '.agents/skills'

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
  const skills = resolve(root, UNIVERSAL_SKILLS_DIR)
  if (!existsSync(skills)) return []

  const repaired = []
  for (const name of readdirSync(skills)) {
    const canonical = resolve(skills, name)
    if (isSymbolicLink(canonical) || !existsSync(resolve(canonical, 'SKILL.md'))) continue
    const redundant = resolve(canonical, name)
    const brokenTarget = `../../${UNIVERSAL_SKILLS_DIR}/${name}`
    if (!isSymbolicLink(redundant) || readlinkSync(redundant) !== brokenTarget) continue
    unlinkSync(redundant)
    repaired.push(`${UNIVERSAL_SKILLS_DIR}/${name}/${name}`)
  }
  return repaired
}
