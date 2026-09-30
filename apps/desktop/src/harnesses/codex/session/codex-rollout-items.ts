import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { ThreadItem } from '../app-server'
import { codexShellCommand } from './codex-shell-words'

// A rollout writes a work item in snake case where `thread/read` answers in camel case.
const workStatuses = {
  in_progress: 'inProgress',
  completed: 'completed',
  failed: 'failed',
  declined: 'declined',
} as const
const workStatusSchema = z.enum(['in_progress', 'completed', 'failed', 'declined'])
const commandSources = {
  agent: 'agent',
  user_shell: 'userShell',
  unified_exec_startup: 'unifiedExecStartup',
  unified_exec_interaction: 'unifiedExecInteraction',
} as const

const commandSchema = z.object({
  type: z.literal('CommandExecution'),
  id: z.string().min(1),
  command: z.array(z.string()),
  cwd: z.string(),
  process_id: z.string().nullish(),
  source: z.enum(['agent', 'user_shell', 'unified_exec_startup', 'unified_exec_interaction']),
  status: workStatusSchema,
  aggregated_output: z.string().nullish(),
  exit_code: z.number().int().nullish(),
})
const changeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('add'), content: z.string().nullish() }),
  z.object({ type: z.literal('delete'), content: z.string().nullish() }),
  z.object({
    type: z.literal('update'),
    unified_diff: z.string().nullish(),
    move_path: z.string().nullish(),
  }),
])
const fileChangeSchema = z.object({
  type: z.literal('FileChange'),
  id: z.string().min(1),
  changes: z.record(z.string(), changeSchema),
  status: workStatusSchema,
})
const mcpToolCallSchema = z.object({
  type: z.literal('McpToolCall'),
  id: z.string().min(1),
  server: z.string(),
  tool: z.string(),
  status: z.enum(['in_progress', 'completed', 'failed']),
  arguments: z.json(),
  result: z.object({ content: z.array(z.json()) }).nullish(),
})
const webSearchSchema = z.object({
  type: z.literal('Extension'),
  kind: z.literal('web.search'),
  id: z.string().min(1),
  query: z.string(),
  action: z
    .discriminatedUnion('type', [
      z.object({
        type: z.literal('search'),
        query: z.string().nullish(),
        queries: z.array(z.string()).nullish(),
      }),
      z.object({ type: z.literal('open_page'), url: z.string().nullish() }),
      z.object({
        type: z.literal('find_in_page'),
        url: z.string().nullish(),
        pattern: z.string().nullish(),
      }),
      z.object({ type: z.literal('other') }),
    ])
    .nullish(),
})
type RolloutSearchAction = NonNullable<z.infer<typeof webSearchSchema>['action']>

type SearchAction = NonNullable<Extract<ThreadItem, { type: 'webSearch' }>['action']>

function searchAction(action: RolloutSearchAction): SearchAction {
  switch (action.type) {
    case 'search':
      return { type: 'search', query: action.query ?? null, queries: action.queries ?? null }
    case 'open_page':
      return { type: 'openPage', url: action.url ?? null }
    case 'find_in_page':
      return { type: 'findInPage', url: action.url ?? null, pattern: action.pattern ?? null }
    case 'other':
      return { type: 'other' }
  }
}
const reasoningSchema = z.object({
  type: z.literal('Reasoning'),
  id: z.string().min(1),
  summary_text: z.array(z.string()),
})

// `thread/read` answers with a path where the rollout keeps a file URL.
function localPath(location: string): string {
  return location.startsWith('file://') ? fileURLToPath(location) : location
}

const decoders = {
  CommandExecution: (value: unknown): ThreadItem | null => {
    const parsed = commandSchema.safeParse(value)
    if (!parsed.success) return null
    const item = parsed.data
    return {
      type: 'commandExecution',
      id: item.id,
      pluginId: null,
      scriptPath: null,
      command: codexShellCommand(item.command),
      cwd: localPath(item.cwd),
      processId: item.process_id ?? null,
      source: commandSources[item.source],
      status: workStatuses[item.status],
      commandActions: [],
      aggregatedOutput: item.aggregated_output ?? null,
      exitCode: item.exit_code ?? null,
      durationMs: null,
    }
  },
  FileChange: (value: unknown): ThreadItem | null => {
    const parsed = fileChangeSchema.safeParse(value)
    if (!parsed.success) return null
    const changes = Object.entries(parsed.data.changes).map(([path, change]) =>
      change.type === 'update'
        ? {
            path,
            kind: { type: 'update' as const, move_path: change.move_path ?? null },
            diff: change.unified_diff ?? '',
          }
        : { path, kind: { type: change.type }, diff: change.content ?? '' },
    )
    return {
      type: 'fileChange',
      id: parsed.data.id,
      changes,
      status: workStatuses[parsed.data.status],
    }
  },
  McpToolCall: (value: unknown): ThreadItem | null => {
    const parsed = mcpToolCallSchema.safeParse(value)
    if (!parsed.success) return null
    const item = parsed.data
    return {
      type: 'mcpToolCall',
      id: item.id,
      server: item.server,
      tool: item.tool,
      status: workStatuses[item.status],
      arguments: item.arguments,
      appContext: null,
      mcpAppUi: null,
      pluginId: null,
      readOnlyHint: null,
      result:
        item.result == null
          ? null
          : { content: item.result.content, structuredContent: null, _meta: null },
      error: null,
      durationMs: null,
    }
  },
  Extension: (value: unknown): ThreadItem | null => {
    // Only a web search draws an activity line; any other extension is left to `thread/read`.
    if ((value as { kind?: unknown }).kind !== 'web.search') return null
    const parsed = webSearchSchema.safeParse(value)
    if (!parsed.success) return null
    const { id, query, action } = parsed.data
    return {
      type: 'webSearch',
      id,
      query,
      action: action == null ? null : searchAction(action),
      results: null,
    }
  },
  Reasoning: (value: unknown): ThreadItem | null => {
    const parsed = reasoningSchema.safeParse(value)
    if (!parsed.success) return null
    return { type: 'reasoning', id: parsed.data.id, summary: parsed.data.summary_text, content: [] }
  },
} as const

type DecodedType = keyof typeof decoders

// The `thread/read` item for a completed rollout work item, or null for a type it does not draw.
// A known type in a shape this cannot read is rejected.
export function codexRolloutWorkItem(
  item: Record<string, unknown>,
  reject: () => void,
): ThreadItem | null {
  const type = item.type
  if (typeof type !== 'string' || !Object.hasOwn(decoders, type)) return null
  const decoded = decoders[type as DecodedType](item)
  const skipped = type === 'Extension' && item.kind !== 'web.search'
  if (decoded === null && !skipped) reject()
  return decoded
}
