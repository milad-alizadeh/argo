// A stop call ends the background command it names as `interrupted` and draws no row. The call
// names the task, and the receipt that started the command names the call, so the join is here.

import type { ToolCall, TranscriptRecord } from '@/domains/sessions/contract/model'
import { withoutCalls } from './spawned-agents'

function isStop(call: ToolCall): call is Extract<ToolCall, { kind: 'subagent-control' }> {
  return call.kind === 'subagent-control' && call.intent === 'stop'
}

function stoppedTask(call: Extract<ToolCall, { kind: 'subagent-control' }>): string | null {
  return call.target
}

export function readingBackgroundStops(records: TranscriptRecord[]): TranscriptRecord[] {
  const callOfTask = new Map<string, string>()
  return records.flatMap((record): TranscriptRecord[] => {
    if (record.kind !== 'message') return [record]
    for (const result of record.toolResults ?? [])
      if (result.background !== undefined) callOfTask.set(result.background.taskId, result.callId)
    const stops = record.toolCalls.filter(isStop)
    if (stops.length === 0) return [record]
    const endings = stops.flatMap((stop): TranscriptRecord[] => {
      const taskId = stoppedTask(stop)
      const callId = taskId === null ? undefined : callOfTask.get(taskId)
      if (taskId === null || callId === undefined) return []
      return [
        {
          kind: 'background-task',
          taskId,
          callId,
          outputPath: null,
          state: 'interrupted',
          summary: null,
          timestamp: record.timestamp,
        },
      ]
    })
    return [withoutCalls(record, stops), ...endings]
  })
}
