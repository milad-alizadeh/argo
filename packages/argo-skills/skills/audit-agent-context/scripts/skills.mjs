// Installed skills: frontmatter is billed every turn, the body when the skill fires.
import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'

export function scanSkills({ root, walk, read, size }) {
  // One directory only, since harnesses symlink the same set under several names.
  const skillDir = ['.agents/skills', '.claude/skills']
    .map((d) => path.join(root, d))
    .find(existsSync)
  const skillFiles = skillDir ? walk(skillDir).filter((f) => path.basename(f) === 'SKILL.md') : []
  const seen = new Set()
  let frontmatterBytes = 0
  const skillBodies = []
  for (const f of skillFiles) {
    const real = realpathSync(f)
    if (seen.has(real)) continue
    seen.add(real)
    const text = read(f)
    const fm = text.match(/^---\n([\s\S]*?)\n---/)
    const name = fm?.[1].match(/^name:\s*(.+)$/m)?.[1] ?? path.basename(path.dirname(f))
    const description = fm?.[1].match(/^description:\s*([\s\S]*?)(?=\n\w+:|$)/m)?.[1] ?? ''
    frontmatterBytes += name.length + description.length
    const bytes = walk(path.dirname(f)).reduce((n, file) => n + size(file), 0)
    skillBodies.push({ name, description: description.trim(), bytes, file: f })
  }
  return { frontmatterBytes, skillBodies }
}
