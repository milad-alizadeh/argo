import type { SessionFeedRow } from '../contract/feed-rows'
import { type ToolResult, toolRows } from '../contract/tool-feed'
import type { ToolCall } from '../contract/transcript'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>

export function toolCall(overrides: Partial<ToolCall> & { id: string; name: string }): ToolCall {
  return { input: {}, ...overrides }
}

export function onlyToolRow(calls: ToolCall[], results = new Map<string, ToolResult>()): ToolRow {
  const [row] = toolRows(calls, { results, skillBodies: new Map() })
  if (row === undefined || row.shape !== 'tool') throw new Error('expected a tool row')
  return row
}
