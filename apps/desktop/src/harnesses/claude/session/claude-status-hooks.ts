import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import {
  type HookTableChanges,
  installedHookPort,
  installHooks,
  removeHooks,
  statusHookReader,
} from '@/harnesses/host/status-hooks'
import type { ExternalSessionHooks } from '@/harnesses/registration'

const settingsSchema = z.record(z.string(), z.unknown())

async function readSettings(file: string): Promise<Record<string, unknown>> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {}
    throw error
  }
  return settingsSchema.parse(JSON.parse(text))
}

// Argo's status hooks in the user settings, `settings.json` in the Claude config folder
// (https://code.claude.com/docs/en/hooks). AskUserQuestion waits through PermissionRequest.
export function createClaudeStatusHooks(): ExternalSessionHooks {
  const folder = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude')
  const file = path.join(folder, 'settings.json')

  async function change(apply: (table: unknown) => HookTableChanges): Promise<void> {
    const settings = await readSettings(file)
    const changes = apply(settings.hooks)
    if (changes.size === 0) return
    const hooks: Record<string, unknown> = { ...(settings.hooks as object | undefined) }
    for (const [event, groups] of changes)
      if (groups === null) delete hooks[event]
      else hooks[event] = groups
    const { hooks: _before, ...rest } = settings
    const next = Object.keys(hooks).length === 0 ? rest : { ...settings, hooks }
    await mkdir(folder, { recursive: true })
    await writeFile(file, `${JSON.stringify(next, null, 2)}\n`)
  }

  return {
    install: (port) => change((table) => installHooks(table, 'claude', port)),
    remove: () => change((table) => removeHooks(table, 'claude')),
    installedPort: async () => installedHookPort((await readSettings(file)).hooks, 'claude'),
    read: statusHookReader({ event: 'PermissionRequest', toolName: 'AskUserQuestion' }),
  }
}
