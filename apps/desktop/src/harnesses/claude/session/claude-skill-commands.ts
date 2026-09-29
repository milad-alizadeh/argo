// Claude lists skills from disk before a Session is live. A running Session replaces this
// with the query's own command list.
import os from 'node:os'
import path from 'node:path'
import {
  type ComposerCommand,
  readComposerCommands,
} from '@/domains/sessions/api/composer-commands'
import { readSkillDirectoryRows, skillRoots } from '@/harnesses/skill-directories'

export function claudeConfigDir(configDir?: string) {
  return configDir ?? process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude')
}

export function claudeSkillRoots(cwd: string | null, configDir: string): string[] {
  return skillRoots(cwd, path.join(configDir, 'skills'), path.join('.claude', 'skills'))
}

export async function readClaudeSkillCommands(input: {
  cwd: string | null
  configDir?: string
  reject?: (shape: string) => void
}): Promise<ComposerCommand[]> {
  const reject = input.reject ?? (() => {})
  const rows = await readSkillDirectoryRows({
    roots: claudeSkillRoots(input.cwd, claudeConfigDir(input.configDir)),
    reject,
    entryShape: 'claude-skill',
    rootShape: 'claude-skill-root',
  })
  return readComposerCommands(rows, reject)
}
