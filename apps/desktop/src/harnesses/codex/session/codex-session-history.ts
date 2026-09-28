import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest } from '../app-server/codex-app-server-client'
import { codexCommandContent } from './codex-command-content'
import { codexSubagentContent } from './codex-subagent-content'

const textContentSchema = z.object({ type: z.literal('text'), text: z.string() }).passthrough()
export const codexThreadItemTypeSchema = z.enum([
  'userMessage',
  'hookPrompt',
  'agentMessage',
  'functionCallOutput',
  'plan',
  'reasoning',
  'commandExecution',
  'fileChange',
  'mcpToolCall',
  'dynamicToolCall',
  'collabAgentToolCall',
  'subAgentActivity',
  'webSearch',
  'imageView',
  'sleep',
  'imageGeneration',
  'enteredReviewMode',
  'exitedReviewMode',
  'contextCompaction',
])
const threadItemRoles: Record<
  z.infer<typeof codexThreadItemTypeSchema>,
  'user' | 'assistant' | null
> = {
  userMessage: 'user',
  hookPrompt: null,
  agentMessage: 'assistant',
  functionCallOutput: null,
  plan: null,
  reasoning: null,
  commandExecution: null,
  fileChange: null,
  mcpToolCall: null,
  dynamicToolCall: null,
  collabAgentToolCall: null,
  subAgentActivity: null,
  webSearch: null,
  imageView: null,
  sleep: null,
  imageGeneration: null,
  enteredReviewMode: null,
  exitedReviewMode: null,
  contextCompaction: null,
}
const itemSchema = z
  .object({
    id: z.string().optional(),
    type: codexThreadItemTypeSchema,
    content: z.array(z.unknown()).optional(),
    text: z.string().optional(),
  })
  .passthrough()
const threadSchema = z
  .object({
    turns: z.array(
      z.object({ id: z.string().min(1).optional(), items: z.array(z.unknown()) }).passthrough(),
    ),
  })
  .passthrough()
const responseSchema = z.object({ thread: threadSchema }).passthrough()

function itemText(item: z.infer<typeof itemSchema>): string | null {
  if (typeof item.text === 'string' && item.text.trim() !== '') return item.text
  const text = (item.content ?? [])
    .flatMap((block) => {
      const parsed = textContentSchema.safeParse(block)
      return parsed.success ? [parsed.data.text] : []
    })
    .join('\n')
    .trim()
  return text === '' ? null : text
}

export function codexContentFromItems(items: unknown[], fallbackPrefix: string): FeedContent[] {
  const content: FeedContent[] = []
  items.forEach((rawItem, itemIndex) => {
    const parsed = itemSchema.parse(rawItem)
    if (parsed.type === 'commandExecution') {
      const command = codexCommandContent(rawItem, 'completed')
      if (command === null) throw new Error('Invalid Codex commandExecution history item')
      content.push(command)
      return
    }
    if (parsed.type === 'subAgentActivity') {
      const delegation = codexSubagentContent(rawItem)
      if (delegation === null) throw new Error('Invalid Codex subAgentActivity history item')
      content.push(delegation)
      return
    }
    const role = threadItemRoles[parsed.type]
    const text = itemText(parsed)
    if (role === null || text === null) return
    content.push({
      kind: 'message',
      id: parsed.id ?? `${fallbackPrefix}:${itemIndex}`,
      role,
      text,
    })
  })
  return content
}

export async function readCodexSessionHistory(
  request: CodexRequest,
  nativeId: string,
): Promise<FeedContent[]> {
  const response = await request(
    'thread/read',
    { threadId: nativeId, includeTurns: true },
    (value) => responseSchema.parse(value),
  )
  const content: FeedContent[] = []
  response.thread.turns.forEach((turn, turnIndex) => {
    content.push(...codexContentFromItems(turn.items, `${nativeId}:${turn.id ?? turnIndex}`))
  })
  return content
}

export async function hasCodexSessionTurn(
  request: CodexRequest,
  nativeId: string,
  turnId: string,
): Promise<boolean> {
  const response = await request(
    'thread/read',
    { threadId: nativeId, includeTurns: true },
    (value) => responseSchema.parse(value),
  )
  return response.thread.turns.some((turn) => turn.id === turnId)
}
