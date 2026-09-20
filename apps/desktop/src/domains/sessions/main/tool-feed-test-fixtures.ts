import type { SessionFeedRow } from '@/domains/sessions/contract/feed-rows'
import { type ToolResult, toolRows } from '@/domains/sessions/contract/tool-feed'
import type { ToolCall } from '@/domains/sessions/contract/transcript'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>

export function toolCall(overrides: ToolCall): ToolCall {
  return overrides
}

// A command the way its harness adapter hands it over: the kind, with no harness tool name in it.
export function executeCall({
  id,
  command,
  label = null,
  background = false,
}: {
  id: string
  command: string
  label?: string | null
  background?: boolean
}): ToolCall {
  return {
    id,
    kind: 'execute',
    command,
    label,
    text: command,
    background,
  }
}

// A file read, a search and a web page read the way an adapter hands them over.
export function readCall(id: string, target: string | null): ToolCall {
  return { id, kind: 'read', target }
}

export function searchCall(id: string, query: string | null, scope: 'files' | 'web'): ToolCall {
  return { id, kind: 'search', scope, query }
}

export function fetchCall(id: string, url: string | null): ToolCall {
  return { id, kind: 'fetch', url }
}

// A file change the way an adapter hands it over.
export function editCall(
  id: string,
  file: string,
  change: 'create' | 'update' | 'delete' = 'update',
) {
  const edited = {
    change,
    file,
    diff: '@@ -1,1 +1,1 @@\n-a\n+b',
    lineCounts: { added: 1, removed: 1 },
  }
  return {
    id,
    kind: 'edit',
    files: [edited],
  } satisfies ToolCall
}

export function onlyToolRow(calls: ToolCall[], results = new Map<string, ToolResult>()): ToolRow {
  const [row] = toolRows(calls, { results, skillBodies: new Map() })
  if (row === undefined || row.shape !== 'tool') throw new Error('expected a tool row')
  return row
}
