import { readPatchFiles } from '@/agents/codex/sessions/apply-patch'
import type { EditedFile, ToolCall } from '@/domains/sessions/contract/transcript'

// The patch is the call's own `patch` field when a script named it, else the bare text of a
// direct `custom_tool_call`.
function patchText({ input }: ToolCall): string | null {
  const text = typeof input.patch === 'string' ? input.patch : input.input
  return typeof text === 'string' ? text : null
}

// A Codex `apply_patch` as the domain's `edit` Tool Call. A patch that names no file still draws
// as an edit, of a file the row cannot name.
export function withEditFacts(call: ToolCall): ToolCall {
  if (call.name !== 'apply_patch') return call
  const patch = patchText(call)
  const files = patch === null ? [] : readPatchFiles(patch)
  const unnamed: EditedFile = {
    change: 'update',
    file: null,
    diff: '',
    lineCounts: { added: 0, removed: 0 },
  }
  return { ...call, edit: { kind: 'edit', files: files.length === 0 ? [unnamed] : files } }
}
