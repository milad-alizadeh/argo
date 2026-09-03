// Installed skills: frontmatter is billed every turn, the SKILL.md body when the skill fires.
import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { kilobytes, read, row, section, size, walk } from './report.mjs'

const LARGE_BODY_BYTES = 8 * 1024
const LONG_DESCRIPTION_BYTES = 300

export function scanSkills(root) {
  // One project directory, since harnesses symlink the same set under several names, plus
  // the user's own skills: both sets are in context every turn.
  const projectDirectory = ['.agents/skills', '.claude/skills']
    .map((directory) => path.join(root, directory))
    .find(existsSync)
  const directories = [projectDirectory, path.join(homedir(), '.claude', 'skills')].filter(Boolean)
  const skillFiles = directories.flatMap((directory) =>
    walk(directory).filter((file) => path.basename(file) === 'SKILL.md'),
  )
  const seen = new Set()
  let frontmatterBytes = 0
  const skills = []
  for (const file of skillFiles) {
    const text = read(file)
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
    const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1] ?? path.basename(path.dirname(file))
    // The harness loads one skill per name; a project copy shadows the user's.
    if (seen.has(name) || seen.has(realpathSync(file))) continue
    seen.add(name)
    seen.add(realpathSync(file))
    const description = frontmatter.match(/^description:\s*([\s\S]*?)(?=\n\w+:|$)/m)?.[1] ?? ''
    frontmatterBytes += name.length + description.length
    skills.push({ name, description: description.trim(), bytes: size(file), file })
  }
  return { frontmatterBytes, skills }
}

export function skillSizes(skills) {
  section(
    `Skill bodies over ${kilobytes(LARGE_BODY_BYTES)} (billed when they fire; disclose reference into sibling files)`,
  )
  const large = skills.filter((skill) => skill.bytes > LARGE_BODY_BYTES)
  for (const skill of large.sort((a, b) => b.bytes - a.bytes))
    row(kilobytes(skill.bytes).padStart(9), skill.name)
  section(
    `Skill descriptions over ${LONG_DESCRIPTION_BYTES} bytes (always-on; front-load the trigger, one clause per branch)`,
  )
  for (const skill of skills.filter((s) => s.description.length > LONG_DESCRIPTION_BYTES))
    row(String(skill.description.length).padStart(9), skill.name)
}
