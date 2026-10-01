import type {
  ContentBlock,
  SessionUpdate,
  ToolCallContent,
  ToolCallStatus,
  ToolCallUpdate,
  ToolKind,
} from '@agentclientprotocol/sdk'
import {
  type FeedContent,
  planContent,
  type ToolPresentation,
} from '@/domains/sessions/api/feed-content'

type ToolContent = Extract<FeedContent, { kind: 'tool' }>
type Role = 'user' | 'assistant' | 'reasoning'

const toolStatuses = {
  pending: 'pending',
  in_progress: 'running',
  completed: 'completed',
  failed: 'failed',
} as const satisfies Record<ToolCallStatus, ToolContent['status']>

const toolPresentations = {
  read: 'read',
  edit: 'edited',
  delete: 'deleted',
  move: 'edited',
  search: 'searched',
  execute: 'command',
  think: 'tool',
  fetch: 'tool',
  switch_mode: 'tool',
  other: 'tool',
} as const satisfies Record<ToolKind, ToolPresentation['kind']>

function blockText(block: ContentBlock): string | null {
  switch (block.type) {
    case 'text':
      return block.text
    case 'resource_link':
      return block.uri
    case 'resource':
      return 'text' in block.resource ? block.resource.text : block.resource.uri
    case 'image':
    case 'audio':
      return null
  }
}

// Null is content the Feed cannot draw: media, and terminals Argo never offers the agent.
function toolPart(item: ToolCallContent): NonNullable<ToolContent['output']> | null {
  switch (item.type) {
    case 'content': {
      const text = blockText(item.content)
      return text === null ? null : [{ kind: 'text', text }]
    }
    case 'diff':
      return [
        {
          kind: 'json',
          value: { path: item.path, oldText: item.oldText ?? null, newText: item.newText },
        },
      ]
    case 'terminal':
      return null
  }
}

function toolInput(value: unknown): ToolContent['input'] {
  if (value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value)) as ToolContent['input']
  } catch {
    return null
  }
}

// Folds one ACP Session's update stream into Feed rows. A row keeps its id while chunks grow it, so
// the live stream and a `session/load` replay of the same Session draw the same rows. ACP gives a
// prompt no client id, so a prompt row is keyed by its place among the Session's prompts.
export class AcpFeedProjection {
  private readonly text = new Map<string, string>()
  private readonly tools = new Map<string, ToolContent>()
  private run: { role: Role; id: string; messageId: string | null } | null = null
  private runs = 0
  private prompts = 0
  rejected = 0

  // The row for a prompt this client sends; the agent does not echo it back live.
  openPrompt(text: string): FeedContent {
    const id = this.nextPromptId(null)
    this.text.set(id, text)
    this.run = null
    return { id, kind: 'message', role: 'user', text }
  }

  private nextPromptId(messageId: string | null): string {
    this.prompts += 1
    const id = `acp-prompt-${this.prompts}`
    this.run = { role: 'user', id, messageId }
    return id
  }

  // Ends the current message so the next chunk opens a new row, as a new Turn does.
  settle(): void {
    this.run = null
  }

  private runId(role: Role, messageId: string | null): string {
    const continues = this.run?.role === role && this.run.messageId === messageId
    if (continues && this.run !== null) return this.run.id
    if (role === 'user') return this.nextPromptId(messageId)
    if (messageId !== null) {
      this.run = { role, id: messageId, messageId }
      return messageId
    }
    this.runs += 1
    this.run = { role, id: `acp-${role}-${this.runs}`, messageId }
    return this.run.id
  }

  private chunk(
    role: Role,
    update: { content: ContentBlock; messageId?: string | null },
  ): FeedContent | null {
    const piece = blockText(update.content)
    if (piece === null) {
      this.rejected += 1
      return null
    }
    const id = this.runId(role, update.messageId ?? null)
    const text = `${this.text.get(id) ?? ''}${piece}`
    this.text.set(id, text)
    return role === 'reasoning'
      ? { id, kind: 'reasoning', text }
      : { id, kind: 'message', role, text }
  }

  private toolOutput(content: readonly ToolCallContent[]): ToolContent['output'] {
    const parts = content.flatMap((item) => {
      const part = toolPart(item)
      if (part === null) this.rejected += 1
      return part ?? []
    })
    return parts.length === 0 ? null : parts
  }

  private tool(update: ToolCallUpdate): FeedContent {
    this.run = null
    const known = this.tools.get(update.toolCallId)
    const kind = update.kind ?? null
    const name = update.title ?? known?.name ?? update.toolCallId
    const next: ToolContent = {
      id: update.toolCallId,
      kind: 'tool',
      callId: update.toolCallId,
      name,
      status: update.status == null ? (known?.status ?? 'pending') : toolStatuses[update.status],
      input: update.rawInput === undefined ? (known?.input ?? null) : toolInput(update.rawInput),
      output: update.content == null ? (known?.output ?? null) : this.toolOutput(update.content),
      summary: known?.summary ?? null,
      presentation:
        kind === null
          ? (known?.presentation ?? { kind: 'tool', label: name })
          : { kind: toolPresentations[kind], label: name },
    }
    this.tools.set(update.toolCallId, next)
    return next
  }

  project(update: SessionUpdate): FeedContent | null {
    switch (update.sessionUpdate) {
      case 'user_message_chunk':
        return this.chunk('user', update)
      case 'agent_message_chunk':
        return this.chunk('assistant', update)
      case 'agent_thought_chunk':
        return this.chunk('reasoning', update)
      case 'tool_call':
      case 'tool_call_update':
        return this.tool(update)
      case 'plan':
        this.run = null
        return planContent(
          'acp-plan',
          update.entries.map((entry) => ({
            text: entry.content,
            done: entry.status === 'completed',
          })),
        )
      // Session metadata the Feed does not draw.
      case 'available_commands_update':
      case 'current_mode_update':
      case 'config_option_update':
      case 'session_info_update':
      case 'usage_update':
        return null
      case 'plan_update':
      case 'plan_removed':
      case 'notice':
      case 'compaction_update':
      case 'compaction_summary_chunk':
        this.rejected += 1
        return null
    }
  }
}
