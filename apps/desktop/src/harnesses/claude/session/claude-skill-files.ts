import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { projectFolders } from '@/harnesses/project-folders'

export type ClaudeSkillFile = (name: string) => string | null

const SKILL_NAME = /^[\w-][\w.-]*$/
// A plugin skill is invoked as `<plugin>:<skill>`; the plugin's own record names where it lives.
const PLUGIN_SKILL_NAME = /^([\w-][\w.-]*):([\w-][\w.-]*)$/

// Each install is validated on its own, so one unreadable entry does not hide every other plugin.
const installedPluginsSchema = z.object({ plugins: z.record(z.string(), z.array(z.unknown())) })
const pluginInstallSchema = z.object({ installPath: z.string().min(1) }).loose()

// Every install folder recorded for one plugin, whichever marketplace it came from.
function pluginInstallPaths(home: string, plugin: string): string[] {
  let record: unknown
  try {
    record = JSON.parse(
      readFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), 'utf8'),
    )
  } catch {
    return []
  }
  const parsed = installedPluginsSchema.safeParse(record)
  if (!parsed.success) {
    console.warn('Skipped 1 unreadable installed-plugins file.')
    return []
  }
  let skipped = 0
  const paths = Object.entries(parsed.data.plugins).flatMap(([key, installs]) =>
    key.split('@')[0] !== plugin
      ? []
      : installs.flatMap((install) => {
          const read = pluginInstallSchema.safeParse(install)
          if (read.success) return [read.data.installPath]
          skipped += 1
          return []
        }),
  )
  if (skipped > 0) console.warn(`Skipped ${skipped} unrecognised installed-plugins record(s).`)
  return paths
}

function pluginSkillFile(home: string, name: string): string | null {
  const invocation = name.match(PLUGIN_SKILL_NAME)
  const plugin = invocation?.[1]
  const skill = invocation?.[2]
  if (plugin === undefined || skill === undefined) return null
  for (const installPath of pluginInstallPaths(home, plugin)) {
    const file = path.join(installPath, 'skills', skill, 'SKILL.md')
    if (existsSync(file)) return file
  }
  return null
}

// The SKILL.md a recorded folder holds, or null once that folder is gone: the row keeps its label
// and offers no expansion, rather than opening a same-named skill the Session never used.
export function claudeSkillFileIn(folder: string): string | null {
  const file = path.join(folder, 'SKILL.md')
  return existsSync(file) ? file : null
}

// Claude Code's lookup: personal skills win over project ones, and a repo-root skill over a nested one.
export function claudeSkillFiles(cwd: string | null, home = os.homedir()): ClaudeSkillFile {
  const folders = [home, ...(cwd === null ? [] : projectFolders(cwd))]
  return (name) => {
    if (!SKILL_NAME.test(name)) return pluginSkillFile(home, name)
    for (const folder of folders) {
      const file = path.join(folder, '.claude', 'skills', name, 'SKILL.md')
      if (existsSync(file)) return file
    }
    return null
  }
}
