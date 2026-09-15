import { isRecord } from '@/boundary'
import type { TranscriptRecord } from '@/core/sessions/transcript'

const SKILL_BODY_PREFIX = 'Base directory for this skill:'

// A user message's `content` is either the raw string the CLI wrote, or (as it is here) a list of
// content blocks; the skill body is the first block of type `text`.
function firstText(content: unknown): string | null {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  const block = content.find((entry) => isRecord(entry) && entry.type === 'text')
  return isRecord(block) && typeof block.text === 'string' ? block.text : null
}

// The Skill tool's own result is a fixed placeholder ("Launching skill: X"); the CLI delivers the
// skill's actual body as a separate, later `isMeta` user record tied back to the call only by
// `sourceToolUseID`, with no XML wrapper `command-envelope.ts` would otherwise recognize.
export function readSkillBody(record: Record<string, unknown>): TranscriptRecord | null {
  if (typeof record.uuid !== 'string' || typeof record.sourceToolUseID !== 'string') return null
  const message = isRecord(record.message) ? record.message : {}
  const text = firstText(message.content)
  if (text === null || !text.startsWith(SKILL_BODY_PREFIX)) return null
  return { kind: 'skill-body', uuid: record.uuid, callId: record.sourceToolUseID, text }
}
