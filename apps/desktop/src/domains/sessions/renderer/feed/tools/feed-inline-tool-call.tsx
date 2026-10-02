import { useTranslation } from 'react-i18next'
import { displayedToolLabel } from '@/domains/sessions/api/feed'
import { FileHeader } from '@/platform/renderer/components/file-header'
import { CodeBlock, CodeBlockCopyButton } from '../../ai-elements'
import { codeLanguageLabel, detectCodeLanguage } from '../content/code-language'
import { CodeLanguageIcon } from '../content/code-language-icon'
import { FeedMarkdown } from '../content/feed-markdown'
import { FEED_CARD_RADIUS_CLASS } from '../content/feed-surface'
import { type ToolGroupState, useToolGroupOpen } from '../rows/tool-group-state'
import { CollapsibleText } from './collapsible-text'
import { StatusIcon } from './feed-tool-status'
import { callRunning, type ToolCall, type ToolRow, toolPresentation } from './feed-tools'

// A command or an unclassified tool call reads as one code block. A Skill call reads as Markdown.
export function FeedInlineToolCall({ call, live }: { call: ToolCall | ToolRow; live: boolean }) {
  const { t } = useTranslation('sessions')
  if (call.kind === 'skill') return <FeedMarkdown text={call.text ?? ''} />
  const result = call.evidence?.kind === 'output' ? call.evidence.source : null
  const source = [call.text, result].filter((part) => part !== null).join('\n')
  const language = detectCodeLanguage(call.text ?? '', call.kind === 'command' ? 'bash' : undefined)
  const languageLabel = codeLanguageLabel(language)
  const header = (
    <FileHeader
      className="bg-muted type-meta"
      leadingIcon={
        <span aria-hidden="true">
          <CodeLanguageIcon language={language} />
        </span>
      }
      heading={languageLabel}
      rightSlot={
        <>
          {call.status === 'failed' && (
            <span className="text-destructive">{t('tools.failed')}</span>
          )}
          {callRunning(call, live) && <StatusIcon status={call.status} />}
          <CodeBlockCopyButton aria-label={t('tools.copyRun')} className="size-7" />
        </>
      }
    />
  )
  // A call whose input carries no text and whose result came back empty (a running call, or a
  // tool that returned nothing) has no code to show; an empty highlighted block read as a bug.
  if (source.trim() === '')
    return (
      <div className={`min-w-0 overflow-hidden border bg-card ${FEED_CARD_RADIUS_CLASS}`}>
        {header}
        <p className="p-4 type-code text-muted-foreground">{t('tools.noOutput')}</p>
      </div>
    )
  return (
    <CodeBlock
      code={source}
      language={language?.grammar ?? null}
      className={`type-code-content min-w-0 bg-card ${FEED_CARD_RADIUS_CLASS}`}
    >
      {header}
    </CodeBlock>
  )
}

// Each command or unclassified call inside a group nests its own collapsible, collapsed by
// default, so a "Ran N commands" group expands to a list of commands rather than N open code blocks.
export function FeedInlineToolCallItem({
  call,
  live,
  toolGroups,
}: {
  call: ToolCall | ToolRow
  live: boolean
  toolGroups: ToolGroupState
}) {
  const { t } = useTranslation('sessions')
  const Icon = toolPresentation(call.kind).icon
  const { onOpenChange, open } = useToolGroupOpen(toolGroups, call.id)
  return (
    <CollapsibleText
      content={() => <FeedInlineToolCall call={call} live={live} />}
      contentVariant="flush"
      icon={Icon}
      onOpenChange={onOpenChange}
      open={open}
      title={displayedToolLabel(call, callRunning(call, live), t('workState.running'))}
    />
  )
}
