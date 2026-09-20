import type { EditedFile, EditFacts } from '@/domains/sessions/contract/model/transcript'
import { createdPatch, unifiedPatch } from '@/domains/sessions/contract/model/unified-patch'

type Input = Record<string, unknown>
type Edits = EditFacts

const lineCount = (text: string) => text.split('\n').length

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

const single = (file: EditedFile): Edits => ({ kind: 'edit', files: [file] })

// Claude records an edit's old and new text, so its diff is known before the result lands.
function edit(input: Input): Edits {
  const oldText = text(input.old_string)
  const newText = text(input.new_string)
  return single({
    change: 'update',
    file: text(input.file_path),
    diff: oldText === null || newText === null ? '' : unifiedPatch(oldText, newText),
    lineCounts: {
      added: newText === null ? 0 : lineCount(newText),
      removed: oldText === null ? 0 : lineCount(oldText),
    },
  })
}

function write(input: Input): Edits {
  const content = text(input.content)
  return single({
    change: 'create',
    file: text(input.file_path),
    diff: content === null ? '' : createdPatch(content),
    lineCounts: { added: content === null ? 0 : lineCount(content), removed: 0 },
  })
}

// A notebook cell change is an update of the notebook; deleting a cell adds no lines.
function notebookEdit(input: Input): Edits {
  const source = text(input.edit_mode) === 'delete' ? null : text(input.new_source)
  return single({
    change: 'update',
    file: text(input.notebook_path),
    diff: source === null ? '' : createdPatch(source),
    lineCounts: { added: source === null ? 0 : lineCount(source), removed: 0 },
  })
}

// Claude's file-changing tools as the domain's `edit` Tool Call (CONTEXT.md L3 · Tool Call).
const EDITS: Record<string, (input: Input) => Edits> = {
  Edit: edit,
  Write: write,
  NotebookEdit: notebookEdit,
}

export function editFacts(name: string, input: Input): Edits | null {
  const read = Object.hasOwn(EDITS, name) ? EDITS[name] : undefined
  return read === undefined ? null : read(input)
}
