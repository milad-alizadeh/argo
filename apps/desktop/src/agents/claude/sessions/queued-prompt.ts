// A prompt the person typed while a Turn ran is absorbed mid-turn: the CLI writes it as a
// `queued_command` attachment, with the prompt's blocks, rather than as a `user` record.
import { isRecord } from '@/boundary'

export function queuedPromptRecord(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  if (record.type !== 'attachment') return null
  const attachment = isRecord(record.attachment) ? record.attachment : null
  if (attachment?.type !== 'queued_command' || attachment.commandMode !== 'prompt') return null
  if (!Array.isArray(attachment.prompt) && typeof attachment.prompt !== 'string') return null
  if (isSubagentHandBack(attachment.prompt)) return null
  return { ...record, message: { role: 'user', content: attachment.prompt } }
}

// A Subagent's report is queued by the harness as an `<agent-message>` prompt nobody typed.
function isSubagentHandBack(prompt: unknown): boolean {
  const first: unknown = Array.isArray(prompt) ? prompt[0] : prompt
  const text = isRecord(first) ? first.text : first
  return typeof text === 'string' && text.trimStart().startsWith('<agent-message')
}
