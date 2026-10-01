import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { decodeClaudeSessionMessages } from '@/harnesses/claude/session/claude-session-history'
import type { ThreadItem } from '@/harnesses/codex/app-server'
import { codexFeedContent } from '@/harnesses/codex/session/codex-feed'

function recordOf(line: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(line)
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

// A Claude transcript's main-chain records, decoded the way a Feed read decodes them.
function claudeContent(lines: readonly string[]): FeedContent[] {
  const messages = lines.flatMap((line) => {
    const record = recordOf(line)
    if (record?.type !== 'user' && record?.type !== 'assistant') return []
    if (record.isMeta === true || record.isSidechain === true) return []
    if (typeof record.uuid !== 'string' || record.uuid === '') return []
    return [{ ...record, session_id: '', parent_tool_use_id: null, parent_agent_id: null }]
  })
  return decodeClaudeSessionMessages(messages as SessionMessage[])
}

// A rollout's completed message as the `thread/read` item the Feed decodes.
function codexItem(line: string): ThreadItem | null {
  const payload = recordOf(line)?.payload as Record<string, unknown> | undefined
  if (payload?.type !== 'item_completed') return null
  const item = payload.item as { type?: unknown; id?: unknown; content?: unknown } | undefined
  if (typeof item?.id !== 'string') return null
  const blocks = Array.isArray(item.content) ? (item.content as { text?: unknown }[]) : []
  const texts = blocks.flatMap((block) => (typeof block.text === 'string' ? [block.text] : []))
  if (item.type === 'UserMessage') {
    const content = texts.map((text) => ({ type: 'text' as const, text, text_elements: [] }))
    return { type: 'userMessage', id: item.id, clientId: null, content }
  }
  if (item.type !== 'AgentMessage') return null
  return {
    type: 'agentMessage',
    id: item.id,
    text: texts.join(''),
    phase: null,
    memoryCitation: null,
    delivery: null,
    questions: null,
  }
}

function codexContent(lines: readonly string[]): FeedContent[] {
  return lines.flatMap((line) => {
    const item = codexItem(line)
    return item === null ? [] : codexFeedContent(item, () => {})
  })
}

export const TRANSCRIPT_CONTENT = { claude: claudeContent, codex: codexContent } as const
