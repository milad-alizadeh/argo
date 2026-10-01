import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import type { LexicalEditor } from 'lexical'
import { type RefObject, useLayoutEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ComposerCommandListing } from '@/domains/sessions/api/composer-commands'
import type { Harness } from '@/harnesses/harness'
import { lastInputWasKeyboard } from '@/platform/renderer/lib/input-modality'
import { useComposerEditing } from '../editing/composer-editing-context'
import { ComposerReferenceMenuPlugin } from '../references/composer-reference-menu-plugin'
import { ComposerReferenceNode } from '../references/composer-reference-node'
import { ComposerReferencePlugin } from '../references/composer-reference-plugin'
import { ComposerTicketReferenceNode } from '../references/composer-ticket-reference-node'
import { ComposerTicketReferencePlugin } from '../references/composer-ticket-reference-plugin'
import { referencesFromCommands } from '../references/session-reference'
import { ComposerEditorAdapter, initialComposerDocument } from './composer-editor-adapter'
import { SendOnEnterPlugin } from './session-composer-enter'
import {
  composerNodes,
  composerTransformers,
  MarkdownPastePlugin,
  MarkdownTypingShortcutPlugin,
} from './session-composer-markdown'

function FocusOnMountPlugin({ enabled, onFocused }: { enabled: boolean; onFocused?: () => void }) {
  const [editor] = useLexicalComposerContext()

  // Focus lands in the commit that makes the editor usable, so no press can come in between (#3036).
  useLayoutEffect(() => {
    if (!enabled) return
    editor.focus()
    onFocused?.()
  }, [editor, enabled, onFocused])

  return null
}

export function ComposerEditor({
  commands,
  disabled = false,
  harness = null,
  contextPickerOpen,
  editorRef,
  focusOnMount,
  onFocusAfterMount,
  onSend,
}: {
  commands: ComposerCommandListing
  disabled?: boolean
  harness?: Harness | null
  contextPickerOpen: boolean
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  onFocusAfterMount?: () => void
  onSend: () => void
}) {
  const { t } = useTranslation('sessions')
  const { editing, dispatch } = useComposerEditing()
  const { prompt: draft, tickets } = editing
  const [showsKeyboardFocus, setShowsKeyboardFocus] = useState(false)
  const [referencesOpen, setReferencesOpen] = useState(false)
  const references = useMemo(() => referencesFromCommands(commands.commands), [commands.commands])
  return (
    <LexicalComposer
      initialConfig={{
        editorState: initialComposerDocument(draft),
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
            aria-disabled={disabled}
            aria-autocomplete="list"
            aria-controls={referencesOpen ? 'composer-references' : undefined}
            aria-expanded={referencesOpen}
            // Named by aria-label; role="combobox" (needed for aria-expanded) allows no aria-placeholder.
            className="min-h-(--size-composer-field) max-h-(--size-composer-field-max) flex-1 overflow-y-auto px-(--spacing-shell-inset) py-(--spacing-shell-gutter) type-prose outline-none [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_blockquote]:my-(--spacing-shell-item) [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-(--spacing-shell-inset) [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_h1]:mt-(--spacing-shell-tight) [&_h1]:mb-(--spacing-shell-item) [&_h1]:!text-title [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mt-(--spacing-shell-section) [&_h2]:mb-(--spacing-shell-item) [&_h2]:!text-heading [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-(--spacing-shell-item) [&_h3]:mb-(--spacing-shell-tight) [&_h3]:!text-heading [&_h3]:font-semibold [&_h3]:text-foreground [&_hr]:my-(--spacing-shell-section) [&_hr]:border-border [&_ol]:my-(--spacing-shell-item) [&_ol]:list-decimal [&_ol]:pl-(--spacing-shell-section) [&_p]:mb-(--spacing-shell-item) [&_ul]:my-(--spacing-shell-item) [&_ul]:list-disc [&_ul]:pl-(--spacing-shell-section) [&>code]:my-(--spacing-shell-item) [&>code]:block [&>code]:rounded-lg [&>code]:bg-muted [&>code]:p-(--spacing-shell-inset) [&>code]:font-mono"
            data-keyboard-focus={showsKeyboardFocus}
            contentEditable={!disabled}
            onBlur={() => setShowsKeyboardFocus(false)}
            onFocus={() => setShowsKeyboardFocus(lastInputWasKeyboard())}
          />
        }
      />
      <ComposerEditorAdapter
        prompt={draft}
        onPromptChange={(prompt) => dispatch({ type: 'prompt.changed', prompt })}
      />
      <MarkdownShortcutPlugin transformers={composerTransformers} />
      <MarkdownTypingShortcutPlugin />
      <ComposerReferencePlugin harness={harness} references={references} />
      <ComposerTicketReferencePlugin tickets={tickets} />
      <HorizontalRulePlugin />
      <MarkdownPastePlugin />
      <EditorRefPlugin editorRef={editorRef} />
      <FocusOnMountPlugin enabled={focusOnMount} onFocused={onFocusAfterMount} />
      <SendOnEnterPlugin onSend={onSend} />
      <ComposerReferenceMenuPlugin
        harness={harness}
        disabled={contextPickerOpen}
        draft={draft}
        listing={commands}
        onOpenChange={setReferencesOpen}
      />
    </LexicalComposer>
  )
}
