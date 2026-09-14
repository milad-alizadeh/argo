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
import {
  Terminal,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalTitle,
} from '@/components/ai-elements/terminal'
import { TOOL_CONTENT_ROUTE } from '@/core/sessions/tool-groups'
import { CollapsibleText } from '@/renderer/components/CollapsibleText'
import type { SessionFeedRow } from '../types'
import { CodeLanguageIcon } from './content/CodeLanguageIcon'
import { codeLanguageLabel, detectCodeLanguage } from './content/codeLanguage'
import { FEED_CARD_RADIUS_CLASS } from './content/feedSurface'

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

// A command needs no separate evidence-panel step: its own text is the thing there is to read,
// so it draws inline as a labelled code block, never styled as a terminal (#2110). Its output, if
// the call has finished, is attached directly beneath it — the terminal styling belongs there,
// since that content genuinely is terminal output.
function FeedInlineCommand({ call }: { call: ToolCall | ToolRow }) {
  const { t } = useTranslation('sessions')
  const source = call.text ?? ''
  const language = detectCodeLanguage(source, 'bash')
  const languageLabel = codeLanguageLabel(language)
  return (
    <div className="space-y-2">
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
            <CodeBlockCopyButton aria-label={t('tools.copyCommand')} className="size-7" />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>
      {call.evidence?.kind === 'output' ? (
        <Terminal output={call.evidence.source} aria-label={call.evidence.title}>
          <TerminalHeader>
            <TerminalTitle className="type-meta" />
            <TerminalCopyButton />
          </TerminalHeader>
          <TerminalContent className="type-code" />
        </Terminal>
      ) : null}
    </div>
  )
}

export function FeedToolGroup({
  group,
  activeEvidenceId,
  open,
  onOpen,
  onOpenChange,
}: {
  group: Extract<SessionFeedRow, { shape: 'tool-group' }>
  activeEvidenceId: string | null
  open: boolean
  onOpen: (row: ToolRow) => void
  onOpenChange: (open: boolean) => void
}) {
  // A code block already draws its own border, which would clash with the connecting line; a
  // group of evidence-panel rows alone keeps the line, matching every collapsible outside a group.
  const hasInlineCall = group.calls.some((call) => TOOL_CONTENT_ROUTE[call.kind] === 'inline')
  return (
    <CollapsibleText
      content={group.calls.map((call) => (
        <TaskItem key={call.id}>
          {TOOL_CONTENT_ROUTE[call.kind] === 'inline' ? (
            <FeedInlineCommand call={call} />
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
