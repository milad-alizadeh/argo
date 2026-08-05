import type { ToolCall, Turn } from '../../shared'
import { asArray, asString, isRecord } from './untrusted'

// Which user records are the CLI talking to ITSELF, and how the ones that ARE a prompt read.
//
// A transcript's `user` records are not all prompts. Claude Code writes several per exchange — the
// local-command caveat, a skill's expanded body, the `[Image: original 2400x2200…]` preamble in
// front of a pasted screenshot — and every one of them opens a Turn if the reader takes it at face
// value. On a real `/implement` run that splits two exchanges into twelve: ten of them empty, each
// titled with the harness's own plumbing rather than with anything anyone asked for.
//
// Nothing here rewords a prompt. It decides which records ARE one, and reassembles a slash command
// from the fields the record itself carries — the reading is still verbatim, it is just taken from
// the fields the CLI put the words in rather than from the markup it wrapped them in.

/** A record the harness wrote to itself.
 *
 * Claude Code's own `isMeta` flag, taken at face value rather than inferred from the text: it is
 * the one signal that separates plumbing from a prompt, and sniffing for `Base directory for this
 * skill:` instead would mean pattern-matching a sentence the user could perfectly well have typed.
 * A CLI that sets no such flag simply has no meta records, which is the honest degradation — the
 * reader never guesses one. */
export const isHarnessMeta = (record: Record<string, unknown>): boolean => record.isMeta === true

/** A local command's own stdout, stored as a user record because that is where the CLI puts it.
 * `/effort`'s confirmation line is output — not a thing anyone asked the agent for, and so not a
 * prompt, but not nothing either: it is what the command in front of it DID. */
const LOCAL_STDOUT = /^\s*<local-command-stdout>([\s\S]*?)<\/local-command-stdout>\s*$/

/** What a local command printed, unwrapped, or `null` for a record that is not one.
 *
 * Read rather than discarded because it is the command's ANSWER: `/effort` opens a turn whose only
 * content is this line, so a reader who drops it sees the question and never the reply. It comes
 * back as a Tool Call's output rather than as prose — a command ran and printed something, which
 * is exactly what a Tool Call is, and filing it as a Message would put the CLI's words in the
 * agent's mouth. */
export function localCommandOutput(content: unknown): string | null {
  const text = firstText(content)
  return text === null ? null : (LOCAL_STDOUT.exec(text)?.[1]?.trim() ?? null)
}

const tag = (text: string, name: string): string | null =>
  new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text)?.[1]?.trim() ?? null

/**
 * A slash command as the user typed it — `/implement 318 open storybook while you do it`.
 *
 * The CLI stores the invocation as three sibling tags (`command-name`, `command-message`,
 * `command-args`) in one record. Rendering that record's raw text titles the exchange
 * `<command-message>implement</command-message>`, which is markup the user never saw; joining the
 * two fields that hold their own words is the same verbatim reading, taken one level in.
 */
export function commandPrompt(text: string): string | null {
  const name = tag(text, 'command-name')
  if (name === null) return null
  const args = tag(text, 'command-args') ?? ''
  return args === '' ? name : `${name} ${args}`
}

const spoken = (part: unknown): string | null => {
  if (typeof part === 'string') return part
  return isRecord(part) && part.type === 'text' ? asString(part.text) : null
}

/** The first textual part of a user record's content with anything in it, whatever shape the CLI
 * stored the content in. Blank parts are stepped over rather than answered with. */
function firstText(content: unknown): string | null {
  const parts = typeof content === 'string' ? [content] : asArray(content)
  for (const part of parts) {
    const text = spoken(part)
    if (text !== null && text.trim() !== '') return text
  }
  return null
}

/**
 * What a local command printed, as the Tool Call it is.
 *
 * A Tool Call rather than prose: a command ran and printed something, which is what a Tool Call IS,
 * and filing it as a Message would attribute the CLI's words to the agent. `execute` specifically,
 * because that kind is always LOUD — a `/effort` turn has this one line in it and nothing else, so
 * folding it into a quiet run would hide the turn's entire content.
 *
 * `derived`, because the text is read off an external record rather than owned by Argo. Its target
 * is the turn's own prompt, which is the invocation this is the answer to.
 */
export function localCommandCall(
  turn: Turn,
  { id, atMs, printed }: { id: string; atMs: number | null; printed: string },
): ToolCall {
  return {
    id,
    name: 'local command',
    kind: 'execute',
    status: 'completed',
    target: turn.prompt,
    result: { kind: 'output', tier: 'derived', text: printed },
    proseIndex: turn.prose.length,
    atMs,
    // A local command prints and is over. There is no second record to learn its end from, and the
    // moment it printed is the moment it finished.
    endedAtMs: atMs,
    usage: null,
  }
}

/**
 * What a user record asks for, or `null` where it asks for nothing.
 *
 * Three readings in one place because they are one question — "is there a prompt in this record,
 * and what is it": a slash command reads as the command, a local command's stdout reads as
 * nothing, and anything else reads as itself, unclamped and untrimmed the way a verbatim prompt
 * must be.
 */
export function userPrompt(content: unknown): string | null {
  const text = firstText(content)
  if (text === null || text.trim() === '') return null
  if (localCommandOutput(content) !== null) return null
  return commandPrompt(text) ?? text
}
