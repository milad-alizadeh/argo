import type { TranscriptRecord } from '@/domains/sessions/contract/transcript'
import { isRecord } from '@/shared/validation'

const SKILL_BODY_PREFIX = 'Base directory for this skill:'

// A user message's `content` is either the raw string the CLI wrote, or (as it is here) a list of
// content blocks; the skill body is the first block of type `text`.
function firstText(content: unknown): string | null {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  const block = content.find((entry) => isRecord(entry) && entry.type === 'text')
  return isRecord(block) && typeof block.text === 'string' ? block.text : null
}

// The body opens with "Base directory for this skill: <path>", a harness line rather than part of
// the skill's own Markdown, so the record drops it up to the blank line that follows.
function skillMarkdown(body: string): string {
  const blankLine = body.indexOf('\n\n')
  return blankLine === -1 ? body : body.slice(blankLine + 2)
}

// The Skill tool's own result is a fixed placeholder ("Launching skill: X"); the CLI delivers the
// skill's actual body as a separate, later `isMeta` user record tied back to the call only by
// `sourceToolUseID`, with no XML wrapper `command-envelope.ts` would otherwise recognize.
export function readSkillBody(record: Record<string, unknown>): TranscriptRecord | null {
  if (typeof record.uuid !== 'string' || typeof record.sourceToolUseID !== 'string') return null
  const message = isRecord(record.message) ? record.message : {}
  const text = firstText(message.content)
  if (text === null || !text.startsWith(SKILL_BODY_PREFIX)) return null
  const body = skillMarkdown(text)
  return { kind: 'skill-body', uuid: record.uuid, callId: record.sourceToolUseID, text: body }
}
