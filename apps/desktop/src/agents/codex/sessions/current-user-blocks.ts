import { USER_HARNESS_ENVELOPES } from '@/agents/codex/sessions/harness-envelopes'
import type { ContentBlock, TranscriptEventKind } from '@/domains/sessions/contract/transcript'
import { isRecord } from '@/shared/validation'

// Codex injects these as user and developer `input_text` blocks, whole and un-nested, so a
// leading-tag match is enough: the envelope configures the harness rather than speaking to the
// reader, so it never becomes history. `app-context` is the desktop app's own.
const HIDDEN_CODEX_ENVELOPES = new Set([
  'environment_context',
  'permissions instructions',
  'skills_instructions',
  'apps_instructions',
  'plugins_instructions',
  'recommended_plugins',
  'codex_internal_context',
  'collaboration_mode',
  'multi_agent_mode',
  'app-context',
])

// codex-rs `UserInstructions` (context/user_instructions.rs, rust-v0.147.0): the AGENTS.md text.
const AGENTS_INSTRUCTIONS = /^\s*# AGENTS\.md instructions[\s\S]*<\/INSTRUCTIONS>\s*$/

// The two protocol updates Codex writes as tagged `input_text` blocks rather than as their own
// `event_msg` type.
const CODEX_PROTOCOL_EVENTS: Record<string, TranscriptEventKind> = {
  transcript_delta: 'transcript',
  status: 'status',
}

// `<codex_internal_context source="goal">` carries an attribute; `<permissions instructions>` a space.
function envelopeName(text: string): string | null {
  return /^\s*<([a-z][a-z0-9_ -]*?)(?:\s+[a-z_]+="[^"]*")*>/i.exec(text)?.[1]?.toLowerCase() ?? null
}

function envelopeBody(text: string, name: string): string | null {
  return new RegExp(`^\\s*<${name}>([\\s\\S]*)</${name}>\\s*$`, 'i').exec(text)?.[1] ?? null
}

// An unenveloped `user` block is the person's own words. Codex writes `developer` role for
// harness-authored model instructions only, so developer text is hidden unless it is a protocol
// event. A user envelope this does not know is neither invented as a prompt nor silently dropped:
// it keeps the generic source fallback. A user envelope `readHarnessEnvelopes` reads stays prose.
function currentUserBlock(text: string, role: 'user' | 'developer'): ContentBlock | 'hidden' {
  if (AGENTS_INSTRUCTIONS.test(text)) return 'hidden'
  const name = envelopeName(text)
  const event = name === null ? undefined : CODEX_PROTOCOL_EVENTS[name]
  if (role === 'developer' && event === undefined) return 'hidden'
  if (name === null || USER_HARNESS_ENVELOPES.has(name)) return { shape: 'prose', text }
  if (HIDDEN_CODEX_ENVELOPES.has(name)) return 'hidden'
  if (event === undefined) return { shape: 'source', label: name, source: text }
  const body = envelopeBody(text, name)
  return {
    shape: 'event',
    event,
    text: event === 'status' ? body?.trim() || null : null,
    raw: text,
  }
}

export function currentUserBlocks(
  content: unknown,
  role: 'user' | 'developer',
): ContentBlock[] | null {
  if (!Array.isArray(content)) return null
  const blocks: ContentBlock[] = []
  for (const block of content) {
    if (!isRecord(block) || block.type !== 'input_text' || typeof block.text !== 'string')
      return null
    const read = currentUserBlock(block.text, role)
    if (read !== 'hidden') blocks.push(read)
  }
  return blocks
}
