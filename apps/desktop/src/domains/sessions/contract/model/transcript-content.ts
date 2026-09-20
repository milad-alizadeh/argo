import type { FeedImageUrl } from '@/domains/sessions/contract/model/feed-images'
import type { FeedMarker } from '@/domains/sessions/contract/model/models'

export type ContentBlock =
  | { shape: 'prose'; text: string }
  | { shape: 'thought'; text: string }
  | { shape: 'marker'; marker: FeedMarker }
  | { shape: 'event'; event: TranscriptEventKind; text: string | null; raw?: string | null }
  | { shape: 'tool'; callId: string }
  | { shape: 'image'; url: FeedImageUrl }
  | { shape: 'file'; path: string }
  | { shape: 'source'; label: string; source: string }

export type RichResultBlock =
  | { shape: 'text'; text: string }
  | { shape: 'image'; url: FeedImageUrl }

export type ToolResult = {
  callId: string
  blocks: RichResultBlock[]
  failed: boolean
  background?: { taskId: string; outputPath: string | null }
}

export const TRANSCRIPT_EVENT_KINDS = ['status', 'transcript', 'context', 'command'] as const
export type TranscriptEventKind = (typeof TRANSCRIPT_EVENT_KINDS)[number]

export function resultText(blocks: readonly RichResultBlock[]): string | null {
  const text = blocks.flatMap((block) => (block.shape === 'text' ? [block.text] : []))
  return text.length === 0 ? null : text.join('\n')
}
