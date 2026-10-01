import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { HookEvent, Settings } from '@anthropic-ai/claude-agent-sdk'
import type { BashInput } from '@anthropic-ai/claude-agent-sdk/sdk-tools'
import { z } from 'zod'
import { type HookTableChanges, STATUS_HOOK_EVENTS } from '@/harnesses/host/status-hooks'
import type { ExternalSessionHooks } from '@/harnesses/registration'

STATUS_HOOK_EVENTS satisfies readonly HookEvent[]

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

// Argo's status hooks in the user settings; the whole file is written once per change.
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
        await mkdir(path.dirname(file), { recursive: true })
        await writeFile(file, `${JSON.stringify(next, null, 2)}\n`)
      }
      return { table: settings.hooks, write }
    },
    group: (command) =>
      ({ hooks: [{ type: 'command', command, async: true }] }) satisfies HookGroup,
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
