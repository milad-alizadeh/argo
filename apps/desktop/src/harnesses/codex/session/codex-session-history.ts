import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest } from '../app-server/codex-app-server-client'

const textContentSchema = z.object({ type: z.literal('text'), text: z.string() }).passthrough()
const threadItemTypeSchema = z.enum([
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
const threadItemRoles: Record<z.infer<typeof threadItemTypeSchema>, 'user' | 'assistant' | null> = {
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
    type: threadItemTypeSchema,
    content: z.array(z.unknown()).optional(),
    text: z.string().optional(),
  })
  .passthrough()
const threadSchema = z
  .object({ turns: z.array(z.object({ items: z.array(z.unknown()) }).passthrough()) })
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
    turn.items.forEach((rawItem, itemIndex) => {
      const parsed = itemSchema.parse(rawItem)
      const role = threadItemRoles[parsed.type]
      const text = itemText(parsed)
      if (role === null || text === null) return
      content.push({
        kind: 'message',
        id: parsed.id ?? `${nativeId}:${turnIndex}:${itemIndex}`,
        role,
        text,
      })
    })
  })
  return content
}
