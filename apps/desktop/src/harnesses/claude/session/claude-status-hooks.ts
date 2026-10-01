import { readFile, realpath, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { HookEvent, Settings } from '@anthropic-ai/claude-agent-sdk'
import type { BashInput } from '@anthropic-ai/claude-agent-sdk/sdk-tools'
import { z } from 'zod'
import { STATUS_HOOK_EVENTS } from '@/harnesses/host/status-hooks'
import type { ExternalSessionHooks, HookTableChanges } from '@/harnesses/registration'
import { writeDocument } from '@/platform/main/storage/portable-file'

export const ASK_USER_QUESTION_TOOL = 'AskUserQuestion'

// The user settings Claude reads its hooks from (https://code.claude.com/docs/en/hooks).
export const claudeSettingsFile = (env: NodeJS.ProcessEnv, home: string) =>
  path.join(env.CLAUDE_CONFIG_DIR ?? path.join(home, '.claude'), 'settings.json')

const settingsSchema = z.record(z.string(), z.unknown())

async function readSettings(file: string): Promise<Record<string, unknown>> {
  try {
    return settingsSchema.parse(JSON.parse(await readFile(file, 'utf8')))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {}
    throw error
  }
}

type HookGroup = NonNullable<Settings['hooks']>[string][number]

// Argo's status hooks in the user settings; the whole file is replaced once per change.
export function createClaudeStatusHooks(): ExternalSessionHooks {
  const file = claudeSettingsFile(process.env, os.homedir())
  return {
    async open() {
      const settings = await readSettings(file)
      const write = async (changes: HookTableChanges) => {
        const hooks: Record<string, unknown> = { ...(settings.hooks as object | undefined) }
        for (const [event, groups] of changes)
          if (groups === null) delete hooks[event]
          else hooks[event] = groups
        const { hooks: _before, ...rest } = settings
        const next = Object.keys(hooks).length === 0 ? rest : { ...settings, hooks }
        // Through a rename, as the file a symlink names, keeping its mode.
        const target = await realpath(file).catch(() => file)
        const mode = await stat(target).then(
          ({ mode }) => mode & 0o777,
          () => 0o644,
        )
        if (!(await writeDocument(target, next, mode)))
          throw new Error(`Could not write ${target}.`)
      }
      return { table: settings.hooks, write }
    },
    group: (command) =>
      ({ hooks: [{ type: 'command', command, async: true }] }) satisfies HookGroup,
    events: STATUS_HOOK_EVENTS satisfies readonly HookEvent[],
    questionTool: ASK_USER_QUESTION_TOOL,
    activityTool: {
      name: 'Bash',
      input: z.looseObject({
        command: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
      }) satisfies z.ZodType<Partial<Pick<BashInput, 'command' | 'description'>>>,
    },
  }
}
