import { useRef } from 'react'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import { PromptText } from '../prompt/PromptText'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { FeedMarkdown } from './content/FeedMarkdown'
import { FeedDelegation } from './FeedDelegation'
import { FeedEvent } from './FeedEvent'
import { FeedQuestion } from './FeedQuestion'
import { FeedToolGroup, FeedToolLine } from './FeedTools'
import { type Reveal, useRevealAnimation } from './reveal'
import type { ToolGroupState } from './tool-group-state'

export type FeedRowProps = {
  row: SessionFeedRow
  reveal?: Reveal
  activeEvidenceId: string | null
  toolGroups: ToolGroupState
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answering: boolean
  questionFailure: string | null
}

export function FeedRow({
  row,
  reveal,
  activeEvidenceId,
  onOpenEvidence,
  toolGroups,
  onAnswerQuestion,
  answering,
  questionFailure,
}: FeedRowProps) {
  const element = useRef<HTMLElement>(null)
  useRevealAnimation(element, reveal)
  return (
    <article
      className={`feed-row feed-row--${row.shape}`}
      data-feed-row={row.id}
      data-revealing={reveal === undefined ? undefined : true}
      data-role={'role' in row ? row.role : undefined}
      ref={element}
    >
      <FeedRowContent
        onOpenEvidence={onOpenEvidence}
        activeEvidenceId={activeEvidenceId}
        toolGroups={toolGroups}
        onAnswerQuestion={onAnswerQuestion}
        answering={answering}
        questionFailure={questionFailure}
        row={row}
      />
    </article>
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
}: FeedRowProps) {
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
            text={row.text}
          />
        )
      return <FeedPrompt text={row.text} />
    case 'ask':
      return (
        <FeedQuestion
          row={row}
          answering={answering}
          failure={questionFailure}
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
    case 'event':
      return <FeedEvent row={row} />
    case 'delegation':
    case 'delegation-group':
      return <FeedDelegation row={row} />
    case 'source':
      return <p>{row.label}</p>
    case 'marker':
      return <p>{row.marker === 'compacted' ? 'Conversation compacted' : 'Interrupted'}</p>
    case 'unreadable':
      return <p>Part of this transcript is damaged, so Argo cannot show it.</p>
  }
}
