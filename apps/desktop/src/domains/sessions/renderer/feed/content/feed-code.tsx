import { FileHeader } from '@/platform/renderer/components/file-header'
import { CodeBlock, CodeBlockCopyButton } from '../../ai-elements'
import { codeLanguageLabel, detectCodeLanguage } from './code-language'
import { CodeLanguageIcon } from './code-language-icon'
import { FEED_CARD_RADIUS_CLASS } from './feed-surface'

export function FeedCode({ source, language }: { source: string; language?: string }) {
  const detectedLanguage = detectCodeLanguage(source, language)
  const languageLabel = codeLanguageLabel(detectedLanguage)
  return (
    <CodeBlock
      code={source}
      language={detectedLanguage?.grammar ?? null}
      className={`type-code-content min-w-0 bg-card ${FEED_CARD_RADIUS_CLASS}`}
    >
      <FileHeader
        className="bg-muted type-meta"
        leadingIcon={
          <span role="img" aria-label={`${languageLabel} file`}>
            <CodeLanguageIcon language={detectedLanguage} />
          </span>
        }
        heading={languageLabel}
        rightSlot={
          <CodeBlockCopyButton
            aria-label={detectedLanguage ? `Copy ${detectedLanguage.label} code` : 'Copy code'}
          />
        }
      />
    </CodeBlock>
  )
}
