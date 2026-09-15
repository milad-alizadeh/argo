import {
  CircleCheck,
  FilePenLine,
  LoaderCircle,
  Search,
  SquareTerminal,
  TerminalIcon,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@/components/ai-elements/code-block'
import { CodeBlockCopyButton } from '@/components/ai-elements/code-block-copy-button'
import { TaskItem } from '@/components/ai-elements/task'
import { TOOL_CONTENT_ROUTE } from '@/core/sessions/tool-groups'
import { CollapsibleText } from '@/renderer/components/CollapsibleText'
import type { SessionFeedRow } from '../types'
import { CodeLanguageIcon } from './content/CodeLanguageIcon'
import { codeLanguageLabel, detectCodeLanguage } from './content/codeLanguage'
import { FEED_CARD_RADIUS_CLASS } from './content/feedSurface'
import { type ToolGroupState, useToolGroupOpen } from './tool-group-state'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>
type ToolCall = Extract<SessionFeedRow, { shape: 'tool-group' }>['calls'][number]

const TOOL_ICONS: Record<ToolRow['kind'], ComponentType<{ className?: string }>> = {
  command: SquareTerminal,
  read: Search,
  edited: FilePenLine,
  created: FilePenLine,
  tool: Wrench,
}

function StatusIcon({ status }: { status: ToolRow['status'] }) {
  switch (status) {
    case 'failed':
      return null
    case 'running':
      return <StatusMark icon={LoaderCircle} label="In progress" className="animate-spin" />
    case 'succeeded':
      return <StatusMark icon={CircleCheck} label="Succeeded" className="text-muted-foreground" />
  }
}

function StatusMark({
  icon: Icon,
  label,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  className: string
}) {
  return (
    <>
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${className}`} />
      <span className="sr-only">{label}</span>
    </>
  )
}

export function FeedToolLine({
  call,
  activeEvidenceId,
  onOpen,
}: {
  call: ToolCall | ToolRow
  activeEvidenceId: string | null
  onOpen: (row: ToolRow) => void
}) {
  const Icon = TOOL_ICONS[call.kind]
  const failed = call.status === 'failed'
  return (
    <button
      type="button"
      aria-current={activeEvidenceId === call.id ? 'location' : undefined}
      className={`flex w-full items-center gap-2 text-left type-body transition-colors ${failed ? 'text-destructive hover:text-destructive' : 'text-muted-foreground hover:text-foreground'} ${activeEvidenceId === call.id && !failed ? 'text-foreground' : ''}`}
      data-feed-evidence-id={call.id}
      onClick={() => onOpen({ ...call, shape: 'tool' })}
    >
      <Icon
        aria-hidden="true"
        className={`!size-(--size-icon-inline) shrink-0 ${failed ? 'text-destructive' : 'text-muted-foreground'}`}
      />
      <span className="min-w-0 flex-1 truncate">{call.label}</span>
      {call.detail === null ? null : (
        <span className={`shrink-0 ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>
          {call.detail}
        </span>
      )}
      {failed ? null : <StatusIcon status={call.status} />}
    </button>
  )
}

// A command or an unclassified tool call reads as one code block despite the transcript's
// separate invocation and result messages, so a lone call in a group never doubles its own label.
function FeedInlineToolCall({ call }: { call: ToolCall | ToolRow }) {
  const { t } = useTranslation('sessions')
  const result = call.evidence?.kind === 'output' ? call.evidence.source : null
  const source = [call.text, result].filter((part) => part !== null).join('\n')
  const language = detectCodeLanguage(call.text ?? '', call.kind === 'command' ? 'bash' : undefined)
  const languageLabel = codeLanguageLabel(language)
  return (
    <CodeBlock
      code={source}
      language={language?.grammar ?? null}
      className={`type-code-content min-w-0 bg-card ${FEED_CARD_RADIUS_CLASS}`}
    >
      <CodeBlockHeader className="bg-muted type-meta">
        <CodeBlockTitle>
          <span aria-hidden="true">
            <CodeLanguageIcon language={language} />
          </span>
          <CodeBlockFilename>{languageLabel}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          {call.status === 'failed' ? (
            <span className="text-destructive">{t('tools.failed')}</span>
          ) : (
            <StatusIcon status={call.status} />
          )}
          <CodeBlockCopyButton aria-label={t('tools.copyRun')} className="size-7" />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  )
}

export function FeedToolGroup({
  group,
  activeEvidenceId,
  onOpen,
  toolGroups,
}: {
  group: Extract<SessionFeedRow, { shape: 'tool-group' }>
  activeEvidenceId: string | null
  onOpen: (row: ToolRow) => void
  toolGroups: ToolGroupState
}) {
  const { onOpenChange, open } = useToolGroupOpen(toolGroups, group.id)
  // A code block already draws its own border, which would clash with the connecting line; a
  // group of evidence-panel rows alone keeps the line, matching every collapsible outside a group.
  const hasInlineCall = group.calls.some((call) => TOOL_CONTENT_ROUTE[call.kind] === 'inline')
  return (
    <CollapsibleText
      content={group.calls.map((call) => (
        <TaskItem key={call.id}>
          {TOOL_CONTENT_ROUTE[call.kind] === 'inline' ? (
            <FeedInlineToolCall call={call} />
          ) : (
            <FeedToolLine activeEvidenceId={activeEvidenceId} call={call} onOpen={onOpen} />
          )}
        </TaskItem>
      ))}
      contentVariant={hasInlineCall ? 'plain' : 'line'}
      icon={TerminalIcon}
      onOpenChange={onOpenChange}
      open={open}
      title={group.label}
    />
  )
}
