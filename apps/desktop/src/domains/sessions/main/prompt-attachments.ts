import type { SessionFeedRow } from '@/domains/sessions/contract/models'
import type { TranscriptMessage } from '@/domains/sessions/contract/transcript'

// A prompt's images and files are drawn in its bubble. A prompt of attachments alone still gets
// one, under the first attachment's own id.
export function withPromptAttachments(
  rows: SessionFeedRow[],
  record: TranscriptMessage,
): SessionFeedRow[] {
  const images = record.blocks.flatMap((block) => (block.shape === 'image' ? [block.url] : []))
  const files = record.blocks.flatMap((block) => (block.shape === 'file' ? [block.path] : []))
  if (record.role !== 'user' || images.length + files.length === 0) return rows
  const attached = {
    ...(images.length > 0 ? { images } : {}),
    ...(files.length > 0 ? { files } : {}),
  }
  const proseIndex = rows.findIndex((row) => row.shape === 'prose')
  if (proseIndex === -1) {
    const index = record.blocks.findIndex(
      (block) => block.shape === 'image' || block.shape === 'file',
    )
    const id = `${record.uuid}:${index}`
    return [{ shape: 'prose', id, role: record.role, text: '', ...attached }, ...rows]
  }
  return rows.map((row, index) => (index === proseIndex ? { ...row, ...attached } : row))
}
