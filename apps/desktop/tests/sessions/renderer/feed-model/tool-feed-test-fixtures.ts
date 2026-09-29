import type { SessionFeedRow } from '@/domains/sessions/api/feed/feed-rows'
import { fileChangeRows } from '@/domains/sessions/api/feed/file-change-rows'
import type { ToolCall } from '@/domains/sessions/api/feed/tool-call'
import { type ToolResult, toolRows } from '@/domains/sessions/api/feed/tool-feed'

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
// A settled edit of one file, drawn the way every Harness's file change reaches the Feed.
export function editRows(
  id: string,
  path: string,
  change: 'add' | 'update' | 'delete' = 'update',
): SessionFeedRow[] {
  return fileChangeRows(
    { kind: 'fileChange', id, status: 'completed', changes: [{ path, change, diff: '-a\n+b' }] },
    'succeeded',
  )
}

export function onlyToolRow(calls: ToolCall[], results = new Map<string, ToolResult>()): ToolRow {
  const [row] = toolRows(calls, { results, skillBodies: new Map() })
  if (row === undefined || row.shape !== 'tool') throw new Error('expected a tool row')
  return row
}
