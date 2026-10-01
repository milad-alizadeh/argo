// Codex lists skills over the app-server and sends `skills/changed` when they change.
import os from 'node:os'
import { z } from 'zod'
import {
  type ComposerCommand,
  readComposerCommands,
} from '@/domains/sessions/api/composer-commands'
import type { CodexRequest, SkillMetadata } from '../app-server'

// Only the fields a command shows are read; the rest of a skill may change shape freely.
const skillSchema = z.object({
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
}) satisfies z.ZodType<Pick<SkillMetadata, 'name' | 'description' | 'enabled'>>

const skillsListSchema = z.object({ data: z.array(z.object({ skills: z.array(z.unknown()) })) })

function skillRows(listing: unknown, reject: (shape: string) => void): unknown[] {
  const parsed = skillsListSchema.safeParse(listing)
  if (!parsed.success) {
    reject('codex-skills-list')
    return []
  }
  return parsed.data.data.flatMap((entry) =>
    entry.skills.flatMap((raw) => {
      const skill = skillSchema.safeParse(raw)
      if (!skill.success) {
        reject('codex-skill')
        return []
      }
      if (!skill.data.enabled) return []
      return [{ name: skill.data.name, description: skill.data.description, argumentHint: '' }]
    }),
  )
}

// Without a folder, the home folder stands in, so only personal skills are listed.
export async function readCodexSkillCommands(
  request: CodexRequest,
  input: { cwd: string | null; reject: (shape: string) => void },
): Promise<ComposerCommand[]> {
  const listing = await request(
    'skills/list',
    { cwds: [input.cwd ?? os.homedir()] },
    (value) => value,
  )
  return readComposerCommands(skillRows(listing, input.reject), input.reject)
}

// Lists once, then again on each `changed`; a list that answers late never replaces a newer one.
export function followCodexSkillCommands(input: {
  request: CodexRequest
  cwd: string
  closed: () => boolean
  onCommands: (commands: ComposerCommand[]) => void
  reject: (shape: string) => void
}): { changed: () => void; stop: () => void } {
  let stopped = false
  let latest = 0
  const changed = () => {
    latest += 1
    const asked = latest
    readCodexSkillCommands(input.request, input).then(
      (commands) => {
        if (!stopped && !input.closed() && asked === latest) input.onCommands(commands)
      },
      () => input.reject('skills/list'),
    )
  }
  changed()
  return {
    changed,
    stop: () => {
      stopped = true
    },
  }
}
