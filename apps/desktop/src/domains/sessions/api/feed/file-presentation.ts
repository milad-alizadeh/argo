import type { FeedContent } from '@/domains/sessions/api/feed-content'

// A row names the file, never the path that reached it: every surface drawing this label is narrow
// and the absolute path is both too long to read and the same prefix on every line (#2273).
export function fileName(path: unknown) {
  if (typeof path !== 'string') return 'file'
  return path.split('/').findLast((segment) => segment.length > 0) ?? path
}

type FileChange = Extract<FeedContent, { kind: 'fileChange' }>['changes'][number]

const FILE_CHANGE_PRESENTATION = {
  add: { kind: 'created', verb: 'Created' },
  update: { kind: 'edited', verb: 'Edited' },
  delete: { kind: 'deleted', verb: 'Deleted' },
} as const satisfies Record<FileChange['change'], { kind: string; verb: string }>

export function fileChangePresentation({ change, path }: Pick<FileChange, 'change' | 'path'>) {
  const { kind, verb } = FILE_CHANGE_PRESENTATION[change]
  return { kind, label: `${verb} ${fileName(path)}` }
}
