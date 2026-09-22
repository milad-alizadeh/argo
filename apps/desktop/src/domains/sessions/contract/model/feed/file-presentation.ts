import type { EditedFile } from '../transcript'

// A row names the file, never the path that reached it: every surface drawing this label is narrow
// and the absolute path is both too long to read and the same prefix on every line (#2273).
export function fileName(path: unknown) {
  if (typeof path !== 'string') return 'file'
  return path.split('/').findLast((segment) => segment.length > 0) ?? path
}

const EDIT_PRESENTATION = {
  create: { kind: 'created', verb: 'Created' },
  update: { kind: 'edited', verb: 'Edited' },
  delete: { kind: 'deleted', verb: 'Deleted' },
} as const

export function editPresentation(file: EditedFile) {
  const { kind, verb } = EDIT_PRESENTATION[file.change]
  return { kind, label: `${verb} ${fileName(file.file)}` }
}
