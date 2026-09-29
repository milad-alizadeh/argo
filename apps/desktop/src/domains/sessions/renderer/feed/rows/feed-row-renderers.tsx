import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import type { SessionEvidence, SessionFeedRow } from '../../types'
import { FeedGallery, FeedImage } from '../content/feed-images'
import { FeedMarkdown } from '../content/feed-markdown'
import { FeedToolGroup, FeedToolLine } from '../tools/feed-tools'
import { FeedEvent } from './feed-event'
import { FeedMarker } from './feed-marker'
import { FeedPrompt } from './feed-prompt'
import { FeedQuestion } from './feed-question'
import { FeedSubagent } from './feed-subagent'
import type { ToolGroupState } from './tool-group-state'

type AssistantProseRow = Extract<SessionFeedRow, { shape: 'prose' }> & { role: 'assistant' }
type PromptRow = Extract<SessionFeedRow, { shape: 'prose' }> & { role: 'user' }
type ToolGroupRow = Extract<SessionFeedRow, { shape: 'tool-group' }>
type ThoughtRow = Extract<SessionFeedRow, { shape: 'thought' }>

// A `thought` row shimmers only while it is the trailing row of a live read, the same as a tool
// group's own tail; once the turn moves past it, it settles like any other historical row.
export function isFeedRowStreaming(
  row: SessionFeedRow,
): row is AssistantProseRow | ToolGroupRow | ThoughtRow {
  return (
    row.shape === 'tool-group' ||
    row.shape === 'thought' ||
    (row.shape === 'prose' && row.role === 'assistant')
  )
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
  onAnswerQuestion: (questionId: string, answers: QuestionAnswer[]) => void
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

function PlainText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words">{text}</p>
}

export const FEED_ROW_RENDERERS = {
  tool: ({ row, activeEvidenceId, onOpenEvidence, streaming }) => (
    <FeedToolLine
      activeEvidenceId={activeEvidenceId}
      call={row}
      live={streaming}
      onOpen={onOpenEvidence}
    />
  ),
  'tool-group': ({ row, activeEvidenceId, onOpenEvidence, toolGroups }) => (
    <FeedToolGroup
      activeEvidenceId={activeEvidenceId}
      group={row}
      onOpen={onOpenEvidence}
      toolGroups={toolGroups}
    />
  ),
  prose: ({ row, activeEvidenceId, onOpenEvidence, streamingText }) =>
    isFeedRowPrompt(row) ? (
      <FeedPrompt
        activeEvidenceId={activeEvidenceId}
        files={row.files}
        images={row.images}
        pastedContent={row.pastedContent}
        onOpenEvidence={onOpenEvidence}
        rowId={row.id}
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
  // Commentary is Markdown; while it is the live tail it is the one line that shimmers.
  thought: ({ row, activeEvidenceId, onOpenEvidence, streaming }) => (
    <div className={`break-words text-muted-foreground ${streaming ? 'feed-work-shimmer' : ''}`}>
      <FeedMarkdown
        activeEvidenceId={activeEvidenceId}
        onOpenEvidence={onOpenEvidence}
        rowId={row.id}
        text={row.text}
      />
    </div>
  ),
  'command-output': ({ row }) => <PlainText text={row.text} />,
  event: ({ row }) => <FeedEvent row={row} />,
  subagent: ({ row }) => <FeedSubagent row={row} />,
  marker: ({ row }) => <FeedMarker row={row} />,
  source: ({ row }) =>
    row.source === '' ? (
      <p>{row.label}</p>
    ) : (
      <details>
        <summary className="cursor-pointer">{row.label}</summary>
        <p className="whitespace-pre-wrap break-words text-muted-foreground">{row.source}</p>
      </details>
    ),
  image: ({ row }) => (
    <FeedGallery>
      <FeedImage alt="" source={row.source} />
    </FeedGallery>
  ),
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
