import { useRef } from 'react'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import { PromptText } from '../prompt/PromptText'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { FeedMarkdown } from './content/FeedMarkdown'
import { FeedQuestion } from './FeedQuestion'
import { FeedToolGroup, FeedToolLine } from './FeedTools'
import { type Reveal, useRevealAnimation } from './reveal'
import { useStreamingText } from './streaming-text'

export type FeedRowProps = {
  row: SessionFeedRow
  height?: number
  reveal?: Reveal
  streaming?: boolean
  activeEvidenceId: string | null
  openToolGroups: ReadonlySet<string>
  onOpenToolGroup: (id: string, open: boolean) => void
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
}

export function FeedRow({
  row,
  height,
  reveal,
  streaming = false,
  activeEvidenceId,
  onOpenEvidence,
  openToolGroups,
  onOpenToolGroup,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
}: FeedRowProps) {
  const element = useRef<HTMLElement>(null)
  const hasStreamed = useRef(streaming)
  if (streaming) hasStreamed.current = true
  const rowReveal = streaming ? undefined : reveal
  const text = useStreamingText(
    row.shape === 'prose' && row.role === 'assistant' ? row.text : '',
    streaming,
  )
  useRevealAnimation(element, rowReveal)
  return (
    <article
      className={`feed-row feed-row--${row.shape}`}
      data-feed-row={row.id}
      data-revealing={rowReveal === undefined ? undefined : true}
      data-role={'role' in row ? row.role : undefined}
      ref={element}
      style={height === undefined || height === 0 ? undefined : { height: `${height}px` }}
    >
      <StreamingStatus hasStreamed={hasStreamed.current} streaming={streaming} />
      <FeedRowContent
        onOpenEvidence={onOpenEvidence}
        activeEvidenceId={activeEvidenceId}
        onOpenToolGroup={onOpenToolGroup}
        openToolGroups={openToolGroups}
        onAnswerQuestion={onAnswerQuestion}
        answeringQuestionId={answeringQuestionId}
        questionFailure={questionFailure}
        row={row}
        streamingText={text}
      />
    </article>
  )
}

function StreamingStatus({ hasStreamed, streaming }: { hasStreamed: boolean; streaming: boolean }) {
  if (!hasStreamed) return null
  return (
    <span aria-live="polite" className="sr-only" role="status">
      {streaming ? 'Assistant is responding.' : 'Assistant response complete.'}
    </span>
  )
}

function FeedRowContent({
  row,
  onOpenEvidence,
  activeEvidenceId,
  openToolGroups,
  onOpenToolGroup,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  streamingText,
}: Omit<FeedRowProps, 'height'> & { streamingText: string }) {
  switch (row.shape) {
    case 'tool':
      return <FeedToolLine activeEvidenceId={activeEvidenceId} call={row} onOpen={onOpenEvidence} />
    case 'tool-group':
      return (
        <FeedToolGroup
          group={row}
          activeEvidenceId={activeEvidenceId}
          onOpen={onOpenEvidence}
          onOpenChange={(open) => onOpenToolGroup(row.id, open)}
          open={openToolGroups.has(row.id)}
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
      return <FeedPrompt text={row.text} />
    case 'ask':
      return (
        <FeedQuestion
          row={row}
          answering={answeringQuestionId === row.id}
          failure={questionFailure(row.id)}
          onAnswer={onAnswerQuestion}
        />
      )
    default:
      return feedRowContent(row)
  }
}

function PlainText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words">{text}</p>
}

function FeedPrompt({ text }: { text: string }) {
  return (
    <p
      className="max-w-full rounded-xl border border-transparent bg-muted px-3 py-2 type-prose sm:max-w-4/5"
      data-slot="bubble"
      data-variant="muted"
    >
      <span className="sr-only">You</span>
      <PromptText text={text} />
    </p>
  )
}

function feedRowContent(
  row: Exclude<SessionFeedRow, { shape: 'tool' | 'tool-group' | 'prose' | 'ask' }>,
) {
  switch (row.shape) {
    case 'thought':
      return <PlainText text={row.text} />
    case 'command-output':
      return <PlainText text={row.text} />
    case 'source':
      return <p>{row.label}</p>
    case 'marker':
      return <p>{row.marker === 'compacted' ? 'Conversation compacted' : 'Interrupted'}</p>
    case 'unreadable':
      return <p>Part of this transcript is damaged, so Argo cannot show it.</p>
  }
}
