import type { FeedContent, MediaSource, PromptFile } from '@/domains/sessions/api/feed-content'
import type { CodexRequest, ThreadItem, ThreadReadResponse, UserInput } from '../app-server'
import { en as copy } from '../locales'
import { codexCommandContent } from './codex-command-content'
import {
  type CodexCollabFacts,
  codexCollabFacts,
  codexSubagentContent,
  withNickname,
} from './codex-subagent-content'
import { readCodexNickname } from './codex-subagent-nicknames'
import { codexTaskNotification } from './codex-task-notification'

type ImageGenerationFailure = NonNullable<
  Extract<ThreadItem, { type: 'imageGeneration' }>['failure']
>
const imageGenerationStatuses = {
  inProgress: 'running',
  completed: 'completed',
  failed: 'failed',
} as const satisfies Record<string, Extract<FeedContent, { kind: 'imageGeneration' }>['status']>
function workStatus(
  status: Extract<
    ThreadItem,
    { type: 'commandExecution' | 'fileChange' | 'mcpToolCall' | 'dynamicToolCall' }
  >['status'],
): Extract<FeedContent, { kind: 'tool' }>['status'] {
  switch (status) {
    case 'inProgress':
      return 'running'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'declined':
      return 'interrupted'
  }
}

// A `text` part whose entire span is one placeholder marks a non-image attachment Codex sent as
// literal path text (`inputItems()` in codex-session-protocol.ts); it names a file, never prose,
// and must not leak the temporary path into the displayed prompt (#2884).
function attachmentPlaceholder(part: Extract<UserInput, { type: 'text' }>): PromptFile | null {
  const [element, ...rest] = part.text_elements ?? []
  if (element === undefined || rest.length > 0 || element.placeholder === null) return null
  if (element.byteRange.start !== 0 || element.byteRange.end !== Buffer.byteLength(part.text))
    return null
  return { label: part.text.split('/').at(-1) ?? part.text, target: part.text }
}

export type PromptSkill = { label: string; target: string }

// Codex names a skill twice: as a typed part, and as a link in the prompt text the model reads.
// The row carries the fact, so the link is not prose and does not belong in the drawn prompt.
function withoutSkillLink(text: string, target: string): string {
  const tail = `](${target})`
  const close = text.indexOf(tail)
  if (close < 0) return text
  const open = text.lastIndexOf('[', close)
  if (open < 0) return text
  const after = close + tail.length
  const spaced = text[after] === ' ' || text[after] === '\t' ? after + 1 : after
  return withoutSkillLink(text.slice(0, open) + text.slice(spaced), target)
}

function withoutSkillLinks(text: string, skills: readonly PromptSkill[]): string {
  return skills.reduce((carried, skill) => withoutSkillLink(carried, skill.target), text).trim()
}

export function userPromptParts(content: UserInput[]): {
  text: string
  images: MediaSource[]
  files: PromptFile[]
  skills: PromptSkill[]
} {
  const text: string[] = []
  const images: MediaSource[] = []
  const files: PromptFile[] = []
  const skills: PromptSkill[] = []
  for (const part of content) {
    switch (part.type) {
      case 'text': {
        const attachment = attachmentPlaceholder(part)
        if (attachment === null) text.push(part.text)
        else files.push(attachment)
        break
      }
      case 'localImage':
        images.push({ kind: 'path', path: part.path })
        break
      case 'image':
        if ('url' in part) images.push({ kind: 'url', url: part.url })
        else console.warn('Rejected 1 unsupported Codex prompt shape: image by fileId.')
        break
      case 'skill':
        skills.push({ label: part.name, target: part.path })
        break
      case 'audio':
      case 'localAudio':
      case 'mention':
        break
    }
  }
  return { text: withoutSkillLinks(text.join('\n'), skills), images, files, skills }
}

function userPromptMessage(
  id: string,
  parts: { text: string; images: MediaSource[]; files: PromptFile[] },
): FeedContent | null {
  if (parts.text === '' && parts.images.length === 0 && parts.files.length === 0) return null
  return {
    kind: 'message',
    id,
    role: 'user',
    text: parts.text,
    ...(parts.images.length > 0 ? { images: parts.images } : {}),
    ...(parts.files.length > 0 ? { files: parts.files } : {}),
  }
}

// Shared with the live channel, so a sent prompt and its reload from history draw the same rows
// instead of the live send showing text-only until history fills in the rest (#2884). A skill row
// comes before the prompt it was sent with, so a Codex skill use draws as a Claude one does.
export function userPromptContents(
  id: string,
  parts: { text: string; images: MediaSource[]; files: PromptFile[]; skills: PromptSkill[] },
): FeedContent[] {
  const message = userPromptMessage(id, parts)
  return [
    ...parts.skills.map(
      (skill, index): FeedContent => ({
        id: `${id}:skill:${index}`,
        kind: 'reference',
        referenceType: 'skill',
        label: skill.label,
        target: skill.target,
        text: null,
      }),
    ),
    ...(message === null ? [] : [message]),
  ]
}

function messageItemContent(
  item: Extract<ThreadItem, { type: 'userMessage' | 'agentMessage' }>,
): FeedContent[] {
  if (item.type === 'agentMessage') {
    if (item.text === '') return []
    return [{ kind: 'message', id: item.id, role: 'assistant', text: item.text, phase: item.phase }]
  }
  const legacyText = 'text' in item && typeof item.text === 'string' ? item.text : ''
  const parts = userPromptParts(item.content ?? [])
  const text = parts.text || legacyText
  const task = codexTaskNotification(item.id, text, () => {
    console.warn('Rejected 1 unsupported Codex task notification.')
  })
  if (task !== null) return [task]
  return userPromptContents(item.id, { ...parts, text })
}

function simpleItemContent(item: ThreadItem): FeedContent[] {
  switch (item.type) {
    case 'reasoning': {
      const summary = item.summary.join('\n').trim()
      return [{ kind: 'reasoning', id: item.id, text: summary || null, redacted: false }]
    }
    case 'contextCompaction':
      return [{ kind: 'marker', id: item.id, marker: 'compaction', summary: null }]
    case 'enteredReviewMode':
    case 'exitedReviewMode':
      return [
        {
          kind: 'marker',
          id: item.id,
          marker: item.type === 'enteredReviewMode' ? 'reviewStarted' : 'reviewEnded',
          summary: null,
        },
      ]
    case 'plan':
      return [{ kind: 'plan', id: item.id, text: item.text }]
    case 'sleep':
      return [{ kind: 'wait', id: item.id, durationMs: item.durationMs }]
    case 'imageView':
      return [
        {
          kind: 'media',
          id: item.id,
          mediaType: 'image',
          source: { kind: 'path', path: item.path },
          role: null,
        },
      ]
    case 'userMessage':
    case 'agentMessage':
      return messageItemContent(item)
    case 'hookPrompt':
    case 'functionCallOutput':
    case 'commandExecution':
    case 'fileChange':
    case 'mcpToolCall':
    case 'dynamicToolCall':
    case 'collabAgentToolCall':
    case 'subAgentActivity':
    case 'webSearch':
    case 'imageGeneration':
      return []
    default:
      throw new Error(`Unsupported Codex history item: ${(item as ThreadItem).type}`)
  }
}

function fileChangeContent(file: Extract<ThreadItem, { type: 'fileChange' }>): FeedContent {
  return {
    kind: 'fileChange',
    id: file.id,
    status: workStatus(file.status),
    changes: file.changes.map((change) => ({
      path: change.path,
      change: change.kind.type,
      diff: change.diff ?? null,
      ...(change.kind.type === 'update' && typeof change.kind.move_path === 'string'
        ? { movedTo: change.kind.move_path }
        : {}),
    })),
  }
}

function toolCallContent(
  tool: Extract<ThreadItem, { type: 'mcpToolCall' | 'dynamicToolCall' }>,
): FeedContent {
  const parts =
    tool.type === 'mcpToolCall' ? (tool.result?.content ?? []) : (tool.contentItems ?? [])
  const output = parts.flatMap((part) => {
    if (part === null || typeof part !== 'object' || !('type' in part)) return []
    if (part.type !== 'text' && part.type !== 'inputText') return []
    if (!('text' in part) || typeof part.text !== 'string') return []
    return [{ kind: 'text' as const, text: part.text }]
  })
  const name = tool.type === 'mcpToolCall' ? `${tool.server}/${tool.tool}` : tool.tool
  return {
    kind: 'tool',
    id: tool.id,
    callId: tool.id,
    name,
    status: workStatus(tool.status),
    input: tool.arguments as Extract<FeedContent, { kind: 'tool' }>['input'],
    output: output.length === 0 ? null : output,
    summary: null,
    presentation: { kind: 'tool', label: name },
  }
}

function searchContent(search: Extract<ThreadItem, { type: 'webSearch' }>): FeedContent {
  return {
    kind: 'search',
    id: search.id,
    query: search.query,
    action: search.action?.type ?? null,
    results: [],
  }
}

function imageGenerationFailureText(failure: ImageGenerationFailure | null): string | null {
  if (failure === null) return null
  switch (failure.type) {
    case 'usageLimitExceeded': {
      const text = copy.imageGeneration.usageLimitExceeded
      if (failure.resetsAt === null) return text
      const reset = new Date(failure.resetsAt * 1000)
      return Number.isFinite(reset.getTime())
        ? copy.imageGeneration.usageLimitExceededWithReset.replace(
            '{{resetTime}}',
            reset.toISOString(),
          )
        : text
    }
  }
}

function imageGenerationContent(
  generated: Extract<ThreadItem, { type: 'imageGeneration' }>,
): FeedContent {
  if (!Object.hasOwn(imageGenerationStatuses, generated.status))
    throw new Error(`Unsupported Codex image generation status: ${generated.status}`)
  const status = imageGenerationStatuses[generated.status as keyof typeof imageGenerationStatuses]
  return {
    kind: 'imageGeneration',
    id: generated.id,
    status,
    prompt: generated.revisedPrompt ?? null,
    source: generated.savedPath == null ? null : { kind: 'path', path: generated.savedPath },
    failure: imageGenerationFailureText(generated.failure ?? null),
  }
}

function codexItemContent(
  item: ThreadItem,
  collab: ReadonlyMap<string, CodexCollabFacts>,
): FeedContent[] {
  switch (item.type) {
    case 'commandExecution':
      return [codexCommandContent(item, 'completed')]
    case 'fileChange':
      return [fileChangeContent(item)]
    case 'mcpToolCall':
    case 'dynamicToolCall':
      return [toolCallContent(item)]
    case 'webSearch':
      return [searchContent(item)]
    case 'imageGeneration':
      return [imageGenerationContent(item)]
    case 'subAgentActivity':
      return [codexSubagentContent(item, collab.get(item.id))]
    case 'collabAgentToolCall':
      return []
    default:
      return simpleItemContent(item)
  }
}

export function codexContentFromItems(items: ThreadItem[]): FeedContent[] {
  const collab = codexCollabFacts(items)
  return items.flatMap((item) => codexItemContent(item, collab))
}

export async function readCodexSessionHistory(
  request: CodexRequest,
  nativeId: string,
): Promise<FeedContent[]> {
  const response = await request(
    'thread/read',
    { threadId: nativeId, includeTurns: true },
    (value) => value as ThreadReadResponse,
  )
  const content: FeedContent[] = []
  response.thread.turns.forEach((turn) => {
    try {
      content.push(...codexContentFromItems(turn.items))
    } catch (error) {
      console.warn('Rejected 1 unsupported Codex history shape.')
      throw error
    }
  })
  return withNicknames(content, request)
}

// Each spawned thread is read for the nickname Codex gave it; no history item carries it.
async function withNicknames(
  content: FeedContent[],
  request: CodexRequest,
): Promise<FeedContent[]> {
  const threads = [
    ...new Set(content.flatMap((entry) => (entry.kind === 'delegation' ? [entry.agentId] : []))),
  ]
  const nicknames = new Map(
    await Promise.all(
      threads.map(
        async (threadId) => [threadId, await readCodexNickname(request, threadId)] as const,
      ),
    ),
  )
  return content.map((entry) =>
    entry.kind === 'delegation' ? withNickname(entry, nicknames.get(entry.agentId) ?? null) : entry,
  )
}

export async function hasCodexSessionTurn(
  request: CodexRequest,
  nativeId: string,
  turnId: string,
): Promise<boolean> {
  const response = await request(
    'thread/read',
    { threadId: nativeId, includeTurns: true },
    (value) => value as ThreadReadResponse,
  )
  return response.thread.turns.some((turn) => turn.id === turnId)
}
