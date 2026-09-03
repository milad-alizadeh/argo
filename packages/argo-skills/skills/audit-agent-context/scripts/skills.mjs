// Installed skills: frontmatter is billed every turn, the body when the skill fires.
import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

export function scanSkills({ root, walk, read, size }) {
  // One project directory, since harnesses symlink the same set under several names, plus
  // the user's own skills: both sets are in context every turn.
  const projectDir = ['.agents/skills', '.claude/skills']
    .map((d) => path.join(root, d))
    .find(existsSync)
  const dirs = [projectDir, path.join(homedir(), '.claude', 'skills')].filter(Boolean)
  const skillFiles = dirs.flatMap((d) => walk(d).filter((f) => path.basename(f) === 'SKILL.md'))
  const seen = new Set()
  let frontmatterBytes = 0
  const skillBodies = []
  for (const f of skillFiles) {
    const text = read(f)
    const fm = text.match(/^---\n([\s\S]*?)\n---/)
    const name = fm?.[1].match(/^name:\s*(.+)$/m)?.[1] ?? path.basename(path.dirname(f))
    // The harness loads one skill per name; a project copy shadows the user's.
    if (seen.has(name) || seen.has(realpathSync(f))) continue
    seen.add(name)
    seen.add(realpathSync(f))
    const description = fm?.[1].match(/^description:\s*([\s\S]*?)(?=\n\w+:|$)/m)?.[1] ?? ''
    frontmatterBytes += name.length + description.length
    const bytes = walk(path.dirname(f)).reduce((n, file) => n + size(file), 0)
    skillBodies.push({ name, description: description.trim(), bytes, file: f })
  }
  return { frontmatterBytes, skillBodies }
}
