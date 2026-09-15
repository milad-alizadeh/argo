import { isRecord } from '@/boundary'
import type { ContentBlock, TranscriptEventKind } from '@/core/sessions/transcript'

// Codex injects these as user and developer `input_text` blocks, whole and un-nested, so a
// leading-tag match is enough: the envelope configures the harness rather than speaking to the
// reader, so it never becomes history.
const HIDDEN_CODEX_ENVELOPES = new Set([
  'environment_context',
  'permissions instructions',
  'skills_instructions',
  'apps_instructions',
  'plugins_instructions',
])

// The two protocol updates Codex writes as tagged `input_text` blocks rather than as their own
// `event_msg` type.
const CODEX_PROTOCOL_EVENTS: Record<string, TranscriptEventKind> = {
  transcript_delta: 'transcript',
  status: 'status',
}

function envelopeName(text: string): string | null {
  return /^\s*<([a-z][a-z0-9_ -]*)>/i.exec(text)?.[1]?.toLowerCase() ?? null
}

function envelopeBody(text: string, name: string): string | null {
  return new RegExp(`^\\s*<${name}>([\\s\\S]*)</${name}>\\s*$`, 'i').exec(text)?.[1] ?? null
}

// An unenveloped `user` block is the person's own words. Codex writes `developer` role for
// harness-authored text only, so unenveloped `developer` text is never a prompt: it keeps the
// generic source fallback rather than being read as something the person said. A recognised
// envelope is either dropped (injected context) or rendered compact with its own text kept for
// diagnostics. An envelope this does not know is neither invented as a prompt nor silently
// dropped — it keeps the generic source fallback too, the same as any other unsupported block.
function currentUserBlock(text: string, role: 'user' | 'developer'): ContentBlock | 'hidden' {
  const name = envelopeName(text)
  if (name === null)
    return role === 'user'
      ? { shape: 'prose', text }
      : { shape: 'source', label: role, source: text }
  if (HIDDEN_CODEX_ENVELOPES.has(name)) return 'hidden'
  const event = CODEX_PROTOCOL_EVENTS[name]
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
