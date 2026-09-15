import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { FeedMarkdown } from './content/FeedMarkdown'
import { FeedQuestion } from './FeedQuestion'
import { FeedToolGroup, FeedToolLine } from './FeedTools'
import { FeedPrompt, FeedRowFallback } from './feed-row-fallback'
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
  onAnswerQuestion: (questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answering: boolean
  questionFailure: string | null
  questionLocked: boolean
}

export function FeedRow({
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
    row.shape === 'prose' && row.role === 'assistant' ? row.text : '',
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
      <StreamingStatus hasStreamed={hasStreamed.current} streaming={streaming} />
      <FeedRowContent
        onOpenEvidence={onOpenEvidence}
        activeEvidenceId={activeEvidenceId}
        toolGroups={toolGroups}
        onAnswerQuestion={onAnswerQuestion}
        answering={answering}
        questionFailure={questionFailure}
        questionLocked={questionLocked}
        row={row}
        streamingText={text}
      />
    </article>
  )
}

function StreamingStatus({ hasStreamed, streaming }: { hasStreamed: boolean; streaming: boolean }) {
  const { t } = useTranslation('sessions')
  if (!hasStreamed) return null
  return (
    <span aria-live="polite" className="sr-only" role="status">
      {streaming ? t('streaming.responding') : t('streaming.complete')}
    </span>
  )
}

function FeedRowContent({
  row,
  onOpenEvidence,
  activeEvidenceId,
  toolGroups,
  onAnswerQuestion,
  answering,
  questionFailure,
  questionLocked,
  streamingText,
}: Omit<FeedRowProps, 'reveal' | 'streaming' | 'revealCache'> & { streamingText: string }) {
  switch (row.shape) {
    // `groupToolRuns` wraps every tool call, lone ones included, so `projectFeed` and
    // `feed-incremental` never emit a bare 'tool' row; kept for exhaustiveness against the
    // shared `ToolRow` type, which `tool-group.calls` still uses.
    case 'tool':
      return <FeedToolLine activeEvidenceId={activeEvidenceId} call={row} onOpen={onOpenEvidence} />
    case 'tool-group':
      return (
        <FeedToolGroup
          group={row}
          activeEvidenceId={activeEvidenceId}
          onOpen={onOpenEvidence}
          toolGroups={toolGroups}
        />
      )
    case 'prose':
      if (row.role === 'assistant')
        return (
          <FeedMarkdown
            activeEvidenceId={activeEvidenceId}
            onOpenEvidence={onOpenEvidence}
            rowId={row.id}
            text={streamingText}
          />
        )
      return <FeedPrompt onOpenEvidence={onOpenEvidence} text={row.text} />
    case 'ask':
      return (
        <FeedQuestion
          row={row}
          answering={answering}
          failure={questionFailure}
          locked={questionLocked}
          onAnswer={onAnswerQuestion}
        />
      )
    default:
      return <FeedRowFallback row={row} />
  }
}
