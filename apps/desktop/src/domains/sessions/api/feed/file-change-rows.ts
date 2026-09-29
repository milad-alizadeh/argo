import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionFeedRow } from './feed-rows'
import { fileChangePresentation, fileName } from './file-presentation'
import { derivedId } from './fingerprint'

type FileChange = Extract<FeedContent, { kind: 'fileChange' }>['changes'][number]

function fileChangeEvidence(change: FileChange): string {
  const text = change.diff ?? ''
  switch (change.change) {
    case 'add':
    case 'delete': {
      const lines = text === '' ? [] : text.replace(/\n$/, '').split('\n')
      const added = change.change === 'add'
      const verb = added ? 'Add' : 'Delete'
      const oldRange = added || lines.length === 0 ? '0,0' : `1,${lines.length}`
      const newRange = !added || lines.length === 0 ? '0,0' : `1,${lines.length}`
      const prefix = added ? '+' : '-'
      return [
        `${verb} File: ${change.path}`,
        `@@ -${oldRange} +${newRange} @@`,
        ...lines.map((line) => `${prefix}${line}`),
      ].join('\n')
    }
    case 'update':
      return `Update File: ${change.movedTo ?? change.path}\n${text}`
  }
}

// Null when the Harness sent no diff: a size the Feed cannot know is not drawn as zero.
function fileChangeLineCounts(change: FileChange) {
  if (change.diff === null || change.diff === '') return null
  const lines = change.diff.replace(/\n$/, '').split('\n')
  const count = (sign: '+' | '-') => lines.filter((line) => line.startsWith(sign)).length
  switch (change.change) {
    case 'add':
      return { added: lines.length, removed: 0 }
    case 'delete':
      return { added: 0, removed: lines.length }
    case 'update':
      return { added: count('+'), removed: count('-') }
  }
}

// A move within one name keeps the destination's folder, so the label never reads "a to a".
function movedName(from: string, to: string) {
  if (fileName(from) !== fileName(to)) return fileName(to)
  return to
    .split('/')
    .filter((segment) => segment.length > 0)
    .slice(-2)
    .join('/')
}

type ToolStatus = Extract<SessionFeedRow, { shape: 'tool' }>['status']

// One row per file, so a group counts files and each line opens its own diff.
export function fileChangeRows(
  content: Extract<FeedContent, { kind: 'fileChange' }>,
  status: ToolStatus,
): SessionFeedRow[] {
  if (content.changes.length === 0)
    return [
      { shape: 'event', id: content.id, event: 'fileChange', text: null, status: content.status },
    ]
  return content.changes.map((change, index) => {
    const edit = fileChangePresentation(change)
    const label =
      change.movedTo === undefined
        ? edit.label
        : `Moved ${fileName(change.path)} to ${movedName(change.path, change.movedTo)}`
    return {
      shape: 'tool',
      id: index === 0 ? content.id : derivedId(content.id, `#${index}`),
      kind: edit.kind,
      label,
      file: change.movedTo ?? change.path,
      lineCounts: fileChangeLineCounts(change),
      status,
      evidence: { kind: 'diff', title: label, source: fileChangeEvidence(change) },
      text: null,
    }
  })
}
