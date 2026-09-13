import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from '@/components/ai-elements/code-block'
import { CodeLanguageIcon } from './CodeLanguageIcon'
import { codeLanguageLabel, detectCodeLanguage } from './codeLanguage'
import { FEED_CARD_RADIUS_CLASS } from './feedSurface'

export function FeedCode({ source, language }: { source: string; language?: string }) {
  const detectedLanguage = detectCodeLanguage(source, language)
  const languageLabel = codeLanguageLabel(detectedLanguage)
  return (
    <CodeBlock
      code={source}
      language={detectedLanguage?.grammar ?? null}
      className={`type-code-content min-w-0 bg-card ${FEED_CARD_RADIUS_CLASS}`}
    >
      <CodeBlockHeader className="bg-muted type-meta">
        <CodeBlockTitle>
          <span role="img" aria-label={`${languageLabel} file`}>
            <CodeLanguageIcon language={detectedLanguage} />
          </span>
          <CodeBlockFilename>{languageLabel}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton
            aria-label={detectedLanguage ? `Copy ${detectedLanguage.label} code` : 'Copy code'}
            className="size-7"
          />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  )
}
