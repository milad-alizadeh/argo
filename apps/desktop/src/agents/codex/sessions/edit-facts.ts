import { readPatchFiles } from '@/agents/codex/sessions/apply-patch'
import type { EditedFile, EditFacts } from '@/domains/sessions/contract/model/transcript'

// The patch is the call's own `patch` field when a script named it, else the bare text of a
// direct `custom_tool_call`.
function patchText(input: Record<string, unknown>): string | null {
  const text = typeof input.patch === 'string' ? input.patch : input.input
  return typeof text === 'string' ? text : null
}

// A Codex `apply_patch` as the domain's `edit` Tool Call. A patch that names no file still draws
// as an edit, of a file the row cannot name.
export function editFacts(name: string, input: Record<string, unknown>): EditFacts | null {
  if (name !== 'apply_patch') return null
  const patch = patchText(input)
  const files = patch === null ? [] : readPatchFiles(patch)
  const unnamed: EditedFile = {
    change: 'update',
    file: null,
    diff: '',
    lineCounts: { added: 0, removed: 0 },
  }
  return { kind: 'edit', files: files.length === 0 ? [unnamed] : files }
}
