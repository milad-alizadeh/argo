import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type {
  FeedContent,
  MediaSource,
  ToolPresentation,
} from '@/domains/sessions/api/feed-content'
import { decodeClaudeText, type RejectClaudeShape } from './claude-feed-envelopes'

type Message = Extract<SDKMessage, { type: 'user' | 'assistant' }>
type System = Extract<SDKMessage, { type: 'system' }>
type UserBlocks = Exclude<Extract<Message, { type: 'user' }>['message']['content'], string>
type Block =
  | Extract<Message, { type: 'assistant' }>['message']['content'][number]
  | UserBlocks[number]
type Tool = Extract<FeedContent, { kind: 'tool' }>
type Prompt = Extract<FeedContent, { kind: 'message' }>
type Task = Extract<FeedContent, { kind: 'task' }>
// Who wrote a block, and the id its row takes.
type Origin = { id: string; role: Message['type']; vendorEnvelope: boolean; humanInput: boolean }

// How a tool call reads in the Feed: its kind, the verb before its subject, and the input key naming it.
const TOOL_LABELS: Record<string, [ToolPresentation['kind'], string, string]> = {
  Bash: ['command', 'Ran', 'command'],
  Read: ['read', 'Read', 'file_path'],
  Edit: ['edited', 'Edited', 'file_path'],
  Write: ['created', 'Created', 'file_path'],
  Grep: ['searched', 'Searched', 'pattern'],
  Glob: ['searched', 'Searched', 'pattern'],
  WebSearch: ['searched', 'Searched', 'query'],
  WebFetch: ['read', 'Read', 'url'],
  Skill: ['skill', 'Skill', 'skill'],
}
const TASK_STATUSES = {
  pending: 'pending',
  running: 'running',
  paused: 'paused',
  completed: 'completed',
  failed: 'failed',
  killed: 'interrupted',
  stopped: 'interrupted',
} as const satisfies Record<string, Task['status']>

function unknown(id: string, vendorType: string, reject: RejectClaudeShape): FeedContent[] {
  reject(vendorType)
  return [{ id, kind: 'diagnostic', vendorType, detail: 'Unsupported Claude output.' }]
}

const BARE_TOOL = {
  name: '',
  status: 'completed',
  input: null,
  output: null,
  summary: null,
} as const

function tool(id: string, callId: string, fields: Partial<Omit<Tool, 'id' | 'kind'>>): Tool {
  return { id, kind: 'tool', callId, ...BARE_TOOL, ...fields }
}

function presentation(name: string, input: unknown): ToolPresentation {
  const fields = (input ?? {}) as Record<string, unknown>
  const [kind, verb, key] = TOOL_LABELS[name] ?? ['tool', name, '']
  const subject = typeof fields[key] === 'string' ? fields[key] : null
  const description = typeof fields.description === 'string' ? fields.description : null
  const label = kind === 'skill' ? (subject ?? verb) : `${verb} ${subject ?? ''}`.trim()
  return {
    kind,
    label: description ?? label.split('\n')[0] ?? '',
    ...(description === null ? {} : { agentDescription: true }),
    ...(kind === 'command' && subject !== null ? { text: subject } : {}),
  }
}

function media(source: { type: string; url?: string; media_type?: string; data?: string }) {
  if (source.type === 'url' && source.url) return { kind: 'url', url: source.url } as const
  if (source.type === 'base64' && source.media_type && source.data)
    return { kind: 'data', mimeType: source.media_type, base64: source.data } as const
  return null
}

function toolResult(
  id: string,
  result: Extract<Block, { type: 'tool_result' }>,
  reject: RejectClaudeShape,
): Tool {
  const parts = typeof result.content === 'string' ? [result.content] : (result.content ?? [])
  const output = parts.flatMap((part): NonNullable<Tool['output']> => {
    if (typeof part === 'string') return [{ kind: 'text', text: part }]
    if (part.type === 'text') return [{ kind: 'text', text: part.text }]
    const source = part.type === 'image' ? media(part.source) : null
    if (source !== null) return [{ kind: 'image', source }]
    // History carries tool_reference metadata outside the SDK's content union.
    if ((part.type as string) !== 'tool_reference') reject('tool-result-part')
    return []
  })
  return tool(id, result.tool_use_id, { status: result.is_error ? 'failed' : 'completed', output })
}

function blockContent(block: Block, origin: Origin, reject: RejectClaudeShape): FeedContent[] {
  const { id } = origin
  switch (block.type) {
    case 'text':
      return block.text.trim() === ''
        ? []
        : [decodeClaudeText({ ...origin, text: block.text }, reject)]
    case 'thinking':
      return block.thinking.trim() === '' ? [] : [{ id, kind: 'reasoning', text: block.thinking }]
    case 'redacted_thinking':
      return []
    case 'tool_use': {
      const { id: callId, name, input } = block
      const facts = { name, status: 'running', input: input as Tool['input'] } as const
      return [tool(id, callId, { ...facts, presentation: presentation(name, input) })]
    }
    case 'tool_result':
      return [toolResult(id, block, reject)]
    case 'image':
    case 'document': {
      const source = media(block.source)
      if (source === null) return unknown(id, `media:${block.source.type}`, reject)
      return [{ id, kind: 'media', mediaType: block.type, source, role: origin.role }]
    }
    // The SDK's server-tool and beta blocks draw nothing Argo shows, so each is counted.
    default:
      return unknown(id, `message-block:${block.type}`, reject)
  }
}

// One user or assistant message. A person's prompt keeps its images and pasted text in one row (#2884).
function messageContent(message: Message, id: string, reject: RejectClaudeShape): FeedContent[] {
  const { content } = message.message
  const blocks: Block[] =
    typeof content === 'string' ? [{ type: 'text', text: content, citations: null }] : content
  const humanInput = message.type === 'user' && message.origin?.kind === 'human'
  const vendorEnvelope = message.type === 'user' && message.origin !== undefined && !humanInput
  const images: MediaSource[] = []
  const pastedContent: { id: string; text: string }[] = []
  const rows = blocks.flatMap((block, index) => {
    const blockId = blocks.length === 1 ? id : `${id}:${index}`
    if (message.type === 'user' && block.type === 'document' && block.source.type === 'text') {
      pastedContent.push({ id: blockId, text: block.source.data })
      return []
    }
    const image = block.type === 'image' && message.type === 'user' ? media(block.source) : null
    const origin = { id: blockId, role: message.type, vendorEnvelope, humanInput }
    if (image === null) return blockContent(block, origin, reject)
    images.push(image)
    return []
  })
  if (images.length === 0 && pastedContent.length === 0) return rows
  const at = rows.findIndex((row) => row.kind === 'message')
  const prompt: Prompt =
    at === -1 ? { id, kind: 'message', role: 'user', text: '' } : (rows[at] as Prompt)
  const folded: Prompt = {
    ...prompt,
    ...(images.length > 0 ? { images } : {}),
    ...(pastedContent.length > 0 ? { pastedContent } : {}),
  }
  return [folded, ...rows.filter((_, index) => index !== at)]
}

const notice = (id: string, text: string): FeedContent[] => [{ id, kind: 'notification', text }]

function persistedFiles(message: Extract<System, { subtype: 'files_persisted' }>): FeedContent[] {
  const { uuid: id, files, failed } = message
  const file = { kind: 'reference', referenceType: 'file', text: null } as const
  const failure = { kind: 'diagnostic', vendorType: 'files_persisted' } as const
  return [
    ...files.map(({ filename: label, file_id: target }, index): FeedContent => {
      return { id: `${id}:file:${index}`, ...file, label, target }
    }),
    ...failed.map(({ filename, error }, index): FeedContent => {
      return { id: `${id}:failed:${index}`, ...failure, detail: `${filename}: ${error}` }
    }),
  ]
}

function taskContent(message: Extract<System, { subtype: `task_${string}` }>): FeedContent[] {
  const { task_id: taskId } = message
  const facts = { id: taskId, kind: 'task', taskId } as const
  switch (message.subtype) {
    case 'task_started':
    case 'task_progress': {
      const summary = message.subtype === 'task_progress' ? (message.summary ?? null) : null
      const { description, tool_use_id: callId = null } = message
      return [{ ...facts, callId, status: 'running', description, summary }]
    }
    case 'task_updated': {
      const { status, description = null, error: summary = null } = message.patch
      const mapped = status === undefined ? null : TASK_STATUSES[status]
      return [{ ...facts, callId: null, status: mapped, description, summary }]
    }
    case 'task_notification': {
      const { tool_use_id: callId = null, summary } = message
      return [
        { ...facts, callId, status: TASK_STATUSES[message.status], description: null, summary },
      ]
    }
  }
}

function systemContent(message: System, reject: RejectClaudeShape): FeedContent[] {
  const id = message.uuid
  switch (message.subtype) {
    case 'task_started':
    case 'task_progress':
    case 'task_updated':
    case 'task_notification':
      return taskContent(message)
    case 'api_retry':
      return notice(id, `API retry ${message.attempt} of ${message.max_retries}: ${message.error}`)
    case 'notification':
      return notice(id, message.text)
    case 'informational':
      return notice(id, message.content)
    case 'plugin_install':
      return notice(id, `${message.name ?? 'Plugin'}: ${message.status}`)
    case 'local_command_output': {
      const output = message.content
      return [{ id, kind: 'command', command: null, status: 'completed', output, stderr: null }]
    }
    case 'files_persisted':
      return persistedFiles(message)
    case 'memory_recall': {
      const memory = { kind: 'reference', referenceType: 'memory' } as const
      return message.memories.map(({ path, content }, index) => {
        return { id: `${id}:${index}`, ...memory, label: path, target: path, text: content ?? null }
      })
    }
    case 'model_refusal_fallback':
    case 'model_refusal_no_fallback':
    case 'permission_denied': {
      const text = message.subtype === 'permission_denied' ? message.message : message.content
      return [{ id, kind: 'refusal', text }]
    }
    case 'mirror_error':
      return [{ id, kind: 'diagnostic', vendorType: 'mirror_error', detail: message.error }]
    case 'compact_boundary':
      return [{ id, kind: 'marker', marker: 'compaction', summary: null }]
    // Lifecycle facts other surfaces read; a status line names what the activity row already shows.
    case 'status':
    case 'init':
    case 'session_state_changed':
    case 'background_tasks_changed':
    case 'thinking_tokens':
    case 'commands_changed':
    case 'worker_shutting_down':
    case 'elicitation_complete':
    case 'control_request_progress':
    case 'hook_started':
    case 'hook_progress':
    case 'hook_response':
      return []
    default: {
      const { subtype } = message satisfies never as System
      // The CLI sends this lifecycle fact outside the SDK's declared subtypes (2.1.286).
      if ((subtype as string) === 'post_turn_summary') return []
      return unknown(id, `system:${subtype}`, reject)
    }
  }
}

function feedContent(message: SDKMessage, id: string, reject: RejectClaudeShape): FeedContent[] {
  // The CLI sends a queued prompt's lifecycle outside the SDK's declared message types (2.1.286).
  if ((message.type as string) === 'command_lifecycle') return []
  switch (message.type) {
    case 'assistant':
      return messageContent(message, message.message.id || id, reject)
    case 'user':
      // A compaction summary is the CLI's own record; a meta record is the CLI talking to itself.
      if (Reflect.get(message, 'isCompactSummary') === true)
        return [{ id, kind: 'marker', marker: 'compaction', summary: null }]
      return Reflect.get(message, 'isMeta') === true ? [] : messageContent(message, id, reject)
    case 'system':
      return systemContent(message, reject)
    case 'tool_progress':
      return [tool(id, message.tool_use_id, { name: message.tool_name, status: 'running' })]
    case 'tool_use_summary':
      return message.preceding_tool_use_ids.map((callId, index) =>
        tool(`${id}:${index}`, callId, { summary: message.summary }),
      )
    case 'prompt_suggestion':
      return notice(id, message.suggestion)
    case 'conversation_reset':
      return [{ id, kind: 'marker', marker: 'conversationReset', summary: null }]
    case 'stream_event':
    case 'result':
    case 'auth_status':
    case 'rate_limit_event':
      return []
    default:
      return unknown(id, `live:${(message satisfies never as SDKMessage).type}`, reject)
  }
}

// The one mapping from Claude output to Feed content, for the live stream and the stored read.
export function claudeFeedContent(message: SDKMessage, reject: RejectClaudeShape): FeedContent[] {
  try {
    return feedContent(message, message.uuid ?? message.session_id ?? crypto.randomUUID(), reject)
  } catch {
    reject(`malformed:${message.type}`)
    return []
  }
}
