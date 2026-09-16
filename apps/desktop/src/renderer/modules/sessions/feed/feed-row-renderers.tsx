import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { FeedMarkdown } from './content/feed-markdown'
import { FeedDelegation } from './feed-delegation'
import { FeedEvent } from './feed-event'
import { FeedMarker } from './feed-marker'
import { FeedQuestion } from './feed-question'
import { FeedPrompt, PlainText } from './feed-row-fallback'
import { FeedToolGroup, FeedToolLine } from './feed-tools'
import type { ToolGroupState } from './tool-group-state'

type AssistantProseRow = Extract<SessionFeedRow, { shape: 'prose' }> & { role: 'assistant' }
type PromptRow = Extract<SessionFeedRow, { shape: 'prose' }> & { role: 'user' }
type ToolGroupRow = Extract<SessionFeedRow, { shape: 'tool-group' }>

export function isFeedRowStreaming(row: SessionFeedRow): row is AssistantProseRow | ToolGroupRow {
  return row.shape === 'tool-group' || (row.shape === 'prose' && row.role === 'assistant')
}

export function isFeedRowPrompt(row: SessionFeedRow): row is PromptRow {
  return row.shape === 'prose' && row.role === 'user'
}

export function isFeedToolGroup(row: SessionFeedRow): row is ToolGroupRow {
  return row.shape === 'tool-group'
}

export type FeedRowRendererProps = {
  row: SessionFeedRow
  activeEvidenceId: string | null
  toolGroups: ToolGroupState
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answering: boolean
  questionFailure: string | null
  questionLocked: boolean
  streaming: boolean
  streamingText: string
}

type FeedRowRenderers = {
  [Shape in SessionFeedRow['shape']]: (
    props: Omit<FeedRowRendererProps, 'row'> & {
      row: Extract<SessionFeedRow, { shape: Shape }>
    },
  ) => ReactNode
}

export const FEED_ROW_RENDERERS = {
  tool: ({ row, activeEvidenceId, onOpenEvidence }) => (
    <FeedToolLine activeEvidenceId={activeEvidenceId} call={row} onOpen={onOpenEvidence} />
  ),
  'tool-group': ({ row, activeEvidenceId, onOpenEvidence, streaming, toolGroups }) => (
    <FeedToolGroup
      activeEvidenceId={activeEvidenceId}
      group={row}
      live={streaming}
      onOpen={onOpenEvidence}
      toolGroups={toolGroups}
    />
  ),
  prose: ({ row, activeEvidenceId, onOpenEvidence, streamingText }) =>
    isFeedRowPrompt(row) ? (
      <FeedPrompt
        files={row.files}
        images={row.images}
        onOpenEvidence={onOpenEvidence}
        text={row.text}
      />
    ) : (
      <FeedMarkdown
        activeEvidenceId={activeEvidenceId}
        onOpenEvidence={onOpenEvidence}
        rowId={row.id}
        text={streamingText}
      />
    ),
  thought: ({ row }) => <PlainText text={row.text} />,
  'command-output': ({ row }) => <PlainText text={row.text} />,
  event: ({ row }) => <FeedEvent row={row} />,
  delegation: ({ row }) => <FeedDelegation row={row} />,
  'delegation-group': ({ row }) => <FeedDelegation row={row} />,
  marker: ({ row }) => <FeedMarker row={row} />,
  source: ({ row }) => <p>{row.label}</p>,
  unreadable: () => <UnreadableRow />,
  ask: ({ row, answering, questionFailure, questionLocked, onAnswerQuestion }) => (
    <FeedQuestion
      answering={answering}
      failure={questionFailure}
      locked={questionLocked}
      onAnswer={onAnswerQuestion}
      row={row}
    />
  ),
} satisfies FeedRowRenderers

export function renderFeedRow(props: FeedRowRendererProps): ReactNode {
  const renderer = FEED_ROW_RENDERERS[props.row.shape] as (props: FeedRowRendererProps) => ReactNode
  return renderer(props)
}

function UnreadableRow() {
  const { t } = useTranslation('sessions')
  return <p>{t('rowUnreadable')}</p>
}
