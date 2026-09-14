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
import { COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND, type LexicalEditor } from 'lexical'
import { type RefObject, useEffect, useRef, useState } from 'react'

import {
  matchesChord,
  pressedKeys,
  SEND_MESSAGE_COMMAND,
  shortcut,
} from '@/core/commands/shortcuts'
import type { SessionCli } from '../harness/harnesses'
import { ComposerReferenceMenuPlugin } from './ComposerReferenceMenuPlugin'
import { ComposerReferenceNode } from './ComposerReferenceNode'
import { ComposerReferencePlugin } from './ComposerReferencePlugin'
import { referenceMenu } from './composer-reference-menu'
import {
  composerNodes,
  composerTransformers,
  MarkdownPastePlugin,
  MarkdownTypingShortcutPlugin,
} from './SessionComposerMarkdown'

const COMPOSER_PLACEHOLDER = 'Direct the next move…'

function editorState(text: string) {
  return () => $convertFromMarkdownString(text, TRANSFORMERS)
}

function ComposerPlaceholder() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 px-(--spacing-shell-inset) py-(--spacing-shell-gutter) type-prose text-muted-foreground"
    >
      {COMPOSER_PLACEHOLDER}
    </span>
  )
}

const SEND_CHORD = shortcut(SEND_MESSAGE_COMMAND).chord

// Lexical inserts a paragraph on Enter's keydown, before any React handler runs, so the send
// claims the command first (#1999).
function SendOnEnterPlugin({ onSend }: { onSend: () => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!event || event.isComposing || !matchesChord(SEND_CHORD, pressedKeys(event))) {
            return false
          }
          event.preventDefault()
          onSend()
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, onSend],
  )

  return null
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
  cli = null,
  draft,
  editorRef,
  focusOnMount,
  onChange,
  onSend,
}: {
  cli?: SessionCli | null
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  focusOnMount: boolean
  onChange: (text: string) => void
  onSend: () => void
}) {
  const focusCameFromPointer = useRef(false)
  const [showsKeyboardFocus, setShowsKeyboardFocus] = useState(false)
  const referencesOpen = referenceMenu(draft) !== null
  return (
    <LexicalComposer
      initialConfig={{
        editorState: editorState(draft),
        namespace: 'argo-session-composer',
        nodes: [...composerNodes, ComposerReferenceNode],
        onError: (error) => {
          throw error
        },
      }}
    >
      <RichTextPlugin
        ErrorBoundary={({ children }) => children}
        contentEditable={
          <ContentEditable
            aria-label="Message"
            aria-autocomplete="list"
            aria-controls={referencesOpen ? 'composer-references' : undefined}
            aria-expanded={referencesOpen}
            aria-placeholder={COMPOSER_PLACEHOLDER}
            className="min-h-(--size-composer-field) flex-1 px-(--spacing-shell-inset) py-(--spacing-shell-gutter) pr-(--inset-composer-plan) type-prose outline-none data-[keyboard-focus=true]:ring-2 data-[keyboard-focus=true]:ring-ring [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_blockquote]:my-(--spacing-shell-item) [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-(--spacing-shell-inset) [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_h1]:mt-(--spacing-shell-tight) [&_h1]:mb-(--spacing-shell-item) [&_h1]:!text-session-title [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mt-(--spacing-shell-section) [&_h2]:mb-(--spacing-shell-item) [&_h2]:!text-composer-section [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-(--spacing-shell-item) [&_h3]:mb-(--spacing-shell-tight) [&_h3]:!text-session-heading [&_h3]:font-semibold [&_h3]:text-foreground [&_hr]:my-(--spacing-shell-section) [&_hr]:border-border [&_ol]:my-(--spacing-shell-item) [&_ol]:list-decimal [&_ol]:pl-(--spacing-shell-section) [&_p]:mb-(--spacing-shell-item) [&_ul]:my-(--spacing-shell-item) [&_ul]:list-disc [&_ul]:pl-(--spacing-shell-section) [&>code]:my-(--spacing-shell-item) [&>code]:block [&>code]:rounded-lg [&>code]:bg-muted [&>code]:p-(--spacing-shell-inset) [&>code]:font-mono"
            data-keyboard-focus={showsKeyboardFocus}
            onBlur={() => setShowsKeyboardFocus(false)}
            onFocus={(event) => {
              setShowsKeyboardFocus(
                !focusCameFromPointer.current && event.currentTarget.matches(':focus-visible'),
              )
              focusCameFromPointer.current = false
            }}
            onPointerDown={() => {
              focusCameFromPointer.current = true
              setShowsKeyboardFocus(false)
            }}
            placeholder={() => null}
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
      <ComposerReferencePlugin cli={cli} />
      <HorizontalRulePlugin />
      <MarkdownPastePlugin />
      <EditorRefPlugin editorRef={editorRef} />
      <FocusOnMountPlugin enabled={focusOnMount} />
      <SendOnEnterPlugin onSend={onSend} />
      <ComposerReferenceMenuPlugin cli={cli} draft={draft} />
    </LexicalComposer>
  )
}
