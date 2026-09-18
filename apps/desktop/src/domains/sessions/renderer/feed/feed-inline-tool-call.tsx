import { useTranslation } from 'react-i18next'
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from '../../../../platform/renderer/components/ai-elements/code-block'
import { CodeBlockCopyButton } from '../../../../platform/renderer/components/ai-elements/code-block-copy-button'
import { CollapsibleText } from '../../../../platform/renderer/components/collapsible-text'
import { displayedToolLabel } from '../../contract/tool-feed'
import { codeLanguageLabel, detectCodeLanguage } from './content/code-language'
import { CodeLanguageIcon } from './content/code-language-icon'
import { FeedMarkdown } from './content/feed-markdown'
import { FEED_CARD_RADIUS_CLASS } from './content/feed-surface'
import { RunningText, StatusIcon } from './feed-tool-status'
import { type ToolCall, type ToolRow, toolPresentation } from './feed-tools'
import { withoutRepeatedTitle } from './skill-title'
import { type ToolGroupState, useToolGroupOpen } from './tool-group-state'

// A command or an unclassified tool call reads as one code block despite the transcript's
// separate invocation and result messages. A Skill call instead reads as the skill's own
// Markdown body (carried through `text`, see `toolText` in tool-feed.ts), not code.
export function FeedInlineToolCall({ call }: { call: ToolCall | ToolRow }) {
  const { t } = useTranslation('sessions')
  if (call.kind === 'skill')
    return <FeedMarkdown text={withoutRepeatedTitle(call.text ?? '', call.label)} />
  const result = call.evidence?.kind === 'output' ? call.evidence.source : null
  const source = [call.text, result].filter((part) => part !== null).join('\n')
  const language = detectCodeLanguage(call.text ?? '', call.kind === 'command' ? 'bash' : undefined)
  const languageLabel = codeLanguageLabel(language)
  const header = (
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
  toolGroups,
}: {
  call: ToolCall | ToolRow
  toolGroups: ToolGroupState
}) {
  const { t } = useTranslation('sessions')
  const Icon = toolPresentation(call.kind).icon
  const { onOpenChange, open } = useToolGroupOpen(toolGroups, call.id)
  return (
    <CollapsibleText
      content={<FeedInlineToolCall call={call} />}
      contentVariant="flush"
      icon={Icon}
      onOpenChange={onOpenChange}
      open={open}
      title={
        <RunningText running={call.status === 'running'}>
          {displayedToolLabel(call, call.status === 'running', t('workState.running'))}
        </RunningText>
      }
    />
  )
}
