// A slash command the composer can offer. Validated at the Harness boundary.
import { z } from 'zod'

const COMMAND_NAME = /^[\w][\w:.-]*$/

export const composerCommandSchema = z.strictObject({
  name: z.string().min(1).max(128),
  description: z.string().max(4000),
  argumentHint: z.string().max(500),
  aliases: z.array(z.string().min(1).max(128)),
})

export type ComposerCommand = z.infer<typeof composerCommandSchema>

// `pending` is a Session whose Harness has not listed commands yet. Claude answers only from a
// live query, so a Session that has not started stays pending. `unavailable` is a Harness with no
// command source. `listed` includes an empty list: the menu's empty state.
export const composerCommandListingSchema = z.strictObject({
  availability: z.enum(['listed', 'pending', 'unavailable']),
  commands: z.array(composerCommandSchema),
})

export type ComposerCommandListing = z.infer<typeof composerCommandListingSchema>

const looseCommand = z.object({
  name: z.string(),
  description: z.string(),
  argumentHint: z.string().optional(),
  aliases: z.array(z.string()).optional(),
})

function commandAliases(name: string, aliases: readonly string[], reject: (shape: string) => void) {
  const kept: string[] = []
  for (const alias of aliases) {
    if (!COMMAND_NAME.test(alias) || alias.length > 128 || alias === name) {
      reject('composer-command-alias')
      continue
    }
    kept.push(alias)
  }
  return kept
}

function commandFromRow(row: unknown, reject: (shape: string) => void): ComposerCommand | null {
  const parsed = looseCommand.safeParse(row)
  if (!parsed.success) {
    reject('composer-command')
    return null
  }
  const hint = parsed.data.argumentHint ?? ''
  if (
    !COMMAND_NAME.test(parsed.data.name) ||
    parsed.data.name.length > 128 ||
    parsed.data.description.length > 4000 ||
    hint.length > 500
  ) {
    reject('composer-command')
    return null
  }
  return {
    name: parsed.data.name,
    description: parsed.data.description,
    argumentHint: hint,
    aliases: commandAliases(parsed.data.name, parsed.data.aliases ?? [], reject),
  }
}

export function readComposerCommands(
  rows: unknown,
  reject: (shape: string) => void,
): ComposerCommand[] {
  if (!Array.isArray(rows)) {
    reject('composer-commands')
    return []
  }
  const commands: ComposerCommand[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const command = commandFromRow(row, reject)
    if (command === null || seen.has(command.name)) continue
    seen.add(command.name)
    commands.push(command)
  }
  return commands
}
