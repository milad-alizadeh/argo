import { memo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive'
import type { SessionEvidence, SessionFeedRow } from '../../types'
import { isFeedRowStreaming, renderFeedRow } from './feed-row-renderers'
import { type Reveal, useRevealAnimation } from './reveal'
import { type RevealCache, type RevealResume, useStreamingText } from './streaming-text'
import type { ToolGroupState } from './tool-group-state'

export type FeedRowProps = {
  row: SessionFeedRow
  reveal?: Reveal
  streaming?: boolean
  activeEvidenceId: string | null
  toolGroups: ToolGroupState
  revealCache: RevealCache
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (questionId: string, answers: QuestionAnswer[]) => void
  answering: boolean
  questionFailure: string | null
  questionLocked: boolean
}

// Memoized, because a write to the open transcript re-renders the document that holds every row,
// and a row that did not change re-parsed its Markdown with it: 194.7ms of the 200.2ms react-markdown
// spent in one 10.8-second idle recording (#2386). Every other prop is held stable by `useDrawnRow`,
// so the comparison is the row itself, which the read keeps when it does not touch it.
export const FeedRow = memo(function FeedRow({
  row,
  reveal,
  streaming = false,
  activeEvidenceId,
  onOpenEvidence,
  toolGroups,
  revealCache,
  onAnswerQuestion,
  answering,
  questionFailure,
  questionLocked,
}: FeedRowProps) {
  const element = useRef<HTMLElement>(null)
  const hasStreamed = useRef(streaming)
  if (streaming) hasStreamed.current = true
  const rowReveal = streaming ? undefined : reveal
  const resume: RevealResume = { rowId: row.id, cache: revealCache }
  const text = useStreamingText(
    isFeedRowStreaming(row) && row.shape === 'prose' ? row.text : '',
    streaming,
    resume,
  )
  useRevealAnimation(element, rowReveal)
  return (
    <article
      className={`feed-row feed-row--${row.shape}`}
      data-feed-row={row.id}
      data-revealing={rowReveal === undefined ? undefined : true}
      data-role={'role' in row ? row.role : undefined}
      ref={element}
    >
      {row.shape === 'prose' ? (
        <StreamingStatus hasStreamed={hasStreamed.current} streaming={streaming} />
      ) : null}
      {renderFeedRow({
        activeEvidenceId,
        answering,
        onAnswerQuestion,
        onOpenEvidence,
        questionFailure,
        questionLocked,
        row,
        streaming,
        streamingText: text,
        toolGroups,
      })}
    </article>
  )
})

function StreamingStatus({ hasStreamed, streaming }: { hasStreamed: boolean; streaming: boolean }) {
  const { t } = useTranslation('sessions')
  if (!hasStreamed) return null
  return (
    <span aria-live="polite" className="sr-only" role="status">
      {streaming ? t('streaming.responding') : t('streaming.complete')}
    </span>
  )
}
