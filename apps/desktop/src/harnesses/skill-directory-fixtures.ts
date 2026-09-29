import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export function writeSkillMarkdown(folder: string, name: string, description: string) {
  const file = path.join(folder, name, 'SKILL.md')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n# Body\n`)
}

export function skillLabels(commands: readonly { name: string; description: string }[]) {
  return commands.map((command) => [command.name, command.description])
}
