// One `exec` script wraps several `tools.exec_command(...)` calls (`nested-tool-call.ts`), and its
// `custom_tool_call_output` answers as many of them as it holds completion items, which is often
// fewer. The rest would read as running forever, so the script's last completion answers them too.
import type { ToolResult, TranscriptRecord } from '@/domains/sessions/contract/model'

// A nested id is `<call_id>:<index>`; a plain function call has no script and stands for itself.
function scriptOf(callId: string): string {
  const separator = callId.lastIndexOf(':')
  return separator === -1 ? callId : callId.slice(0, separator)
}

function messageRecords(records: TranscriptRecord[]) {
  return records.flatMap((record, index) => (record.kind === 'message' ? [{ record, index }] : []))
}

export function answeringEveryNestedCall(records: TranscriptRecord[]): TranscriptRecord[] {
  const nestedIds = new Map<string, string[]>()
  const answered = new Set<string>()
  // Only a script's last output pads it, so two outputs for one script never both answer a call.
  const lastAnswer = new Map<string, number>()
  for (const { record, index } of messageRecords(records)) {
    for (const call of record.toolCalls) {
      const script = scriptOf(call.id)
      nestedIds.set(script, [...(nestedIds.get(script) ?? []), call.id])
    }
    for (const result of record.toolResults ?? []) {
      answered.add(result.callId)
      lastAnswer.set(scriptOf(result.callId), index)
    }
  }
  return records.map((record, index) => {
    if (record.kind !== 'message') return record
    const last = record.toolResults?.at(-1)
    if (last === undefined || lastAnswer.get(scriptOf(last.callId)) !== index) return record
    const missing = (nestedIds.get(scriptOf(last.callId)) ?? []).filter((id) => !answered.has(id))
    if (missing.length === 0) return record
    const toolResults: ToolResult[] = [
      ...(record.toolResults ?? []),
      ...missing.map((callId) => ({ ...last, callId })),
    ]
    return { ...record, toolResults, answeredCalls: toolResults.map((result) => result.callId) }
  })
}
