import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import type { LexicalEditor } from 'lexical'
import { type RefObject, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { lastInputWasKeyboard } from '@/platform/renderer/lib/input-modality'
import type { SessionHarness } from '../../harness'
import type { ComposerTicketContext } from '../hooks'
import { ComposerReferenceMenuPlugin } from '../references/composer-reference-menu-plugin'
import { ComposerReferenceNode } from '../references/composer-reference-node'
import { ComposerReferencePlugin } from '../references/composer-reference-plugin'
import { ComposerTicketReferenceNode } from '../references/composer-ticket-reference-node'
import { ComposerTicketReferencePlugin } from '../references/composer-ticket-reference-plugin'
import { SendOnEnterPlugin } from './session-composer-enter'
import {
  composerNodes,
  composerTransformers,
  MarkdownPastePlugin,
  MarkdownTypingShortcutPlugin,
} from './session-composer-markdown'

function editorState(text: string) {
  return () => $convertFromMarkdownString(text, TRANSFORMERS)
}

function ComposerPlaceholder() {
  const { t } = useTranslation('sessions')
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 px-(--spacing-shell-inset) py-(--spacing-shell-gutter) type-prose text-muted-foreground"
    >
      {t('composer.placeholder')}
    </span>
  )
}

function FocusOnMountPlugin({ enabled }: { enabled: boolean }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!enabled) return
    const frame = window.requestAnimationFrame(() => editor.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [editor, enabled])

  return null
}

export function ComposerEditor({
  harness = null,
  contextPickerOpen,
  draft,
  editorRef,
  focusOnMount,
  onChange,
  onSend,
  tickets,
}: {
  harness?: SessionHarness | null
  contextPickerOpen: boolean
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  onChange: (text: string) => void
  onSend: () => void
  tickets: ComposerTicketContext[]
}) {
  const { t } = useTranslation('sessions')
  const [showsKeyboardFocus, setShowsKeyboardFocus] = useState(false)
  const [referencesOpen, setReferencesOpen] = useState(false)
  return (
    <LexicalComposer
      initialConfig={{
        editorState: editorState(draft),
        namespace: 'argo-session-composer',
        nodes: [...composerNodes, ComposerReferenceNode, ComposerTicketReferenceNode],
        onError: (error) => {
          throw error
        },
      }}
    >
      <RichTextPlugin
        ErrorBoundary={({ children }) => children}
        contentEditable={
          <ContentEditable
            role="combobox"
            aria-label={t('composer.message')}
            aria-autocomplete="list"
            aria-controls={referencesOpen ? 'composer-references' : undefined}
            aria-expanded={referencesOpen}
            // No aria-placeholder: role="combobox" (needed for aria-expanded) doesn't allow it, and
            // `ComposerPlaceholder` already renders the same text, visibly, beside this field.
            className="min-h-(--size-composer-field) flex-1 px-(--spacing-shell-inset) py-(--spacing-shell-gutter) pr-(--inset-composer-plan) type-prose outline-none [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_blockquote]:my-(--spacing-shell-item) [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-(--spacing-shell-inset) [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_h1]:mt-(--spacing-shell-tight) [&_h1]:mb-(--spacing-shell-item) [&_h1]:!text-title [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mt-(--spacing-shell-section) [&_h2]:mb-(--spacing-shell-item) [&_h2]:!text-heading [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-(--spacing-shell-item) [&_h3]:mb-(--spacing-shell-tight) [&_h3]:!text-heading [&_h3]:font-semibold [&_h3]:text-foreground [&_hr]:my-(--spacing-shell-section) [&_hr]:border-border [&_ol]:my-(--spacing-shell-item) [&_ol]:list-decimal [&_ol]:pl-(--spacing-shell-section) [&_p]:mb-(--spacing-shell-item) [&_ul]:my-(--spacing-shell-item) [&_ul]:list-disc [&_ul]:pl-(--spacing-shell-section) [&>code]:my-(--spacing-shell-item) [&>code]:block [&>code]:rounded-lg [&>code]:bg-muted [&>code]:p-(--spacing-shell-inset) [&>code]:font-mono"
            data-keyboard-focus={showsKeyboardFocus}
            onBlur={() => setShowsKeyboardFocus(false)}
            onFocus={() => setShowsKeyboardFocus(lastInputWasKeyboard())}
          />
        }
        placeholder={<ComposerPlaceholder />}
      />
      <OnChangePlugin
        onChange={(state) => {
          state.read(() => onChange($convertToMarkdownString(TRANSFORMERS)))
        }}
      />
      <MarkdownShortcutPlugin transformers={composerTransformers} />
      <MarkdownTypingShortcutPlugin />
      <ComposerReferencePlugin harness={harness} />
      <ComposerTicketReferencePlugin tickets={tickets} />
      <HorizontalRulePlugin />
      <MarkdownPastePlugin />
      <EditorRefPlugin editorRef={editorRef} />
      <FocusOnMountPlugin enabled={focusOnMount} />
      <SendOnEnterPlugin onSend={onSend} />
      <ComposerReferenceMenuPlugin
        harness={harness}
        disabled={contextPickerOpen}
        draft={draft}
        onOpenChange={setReferencesOpen}
      />
    </LexicalComposer>
  )
}
