import { CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import type { LexicalEditor } from 'lexical'
import { type RefObject, useRef, useState } from 'react'
import { ComposerReferenceMenuPlugin } from './ComposerReferenceMenuPlugin'
import { ComposerReferenceNode } from './ComposerReferenceNode'
import { ComposerReferencePlugin } from './ComposerReferencePlugin'
import { ComposerSubmitPlugin } from './ComposerSubmitPlugin'
import { composerPlaceholder, referenceMenu } from './composer-reference-menu'

function editorState(markdown: string) {
  return () => $convertFromMarkdownString(markdown, TRANSFORMERS)
}

export function ComposerEditor({
  draft,
  editorRef,
  onChange,
  onSend,
}: {
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  onChange: (text: string) => void
  onSend: () => void
}) {
  const referencesOpen = referenceMenu(draft) !== null
  return (
    <LexicalComposer
      initialConfig={{
        editorState: editorState(draft),
        namespace: 'argo-session-composer',
        nodes: [
          CodeNode,
          ComposerReferenceNode,
          HeadingNode,
          LinkNode,
          ListItemNode,
          ListNode,
          QuoteNode,
        ],
        onError: (error) => {
          throw error
        },
      }}
    >
      <ComposerTextArea referencesOpen={referencesOpen} />
      <HistoryPlugin />
      <LinkPlugin />
      <ListPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <ComposerReferencePlugin />
      <ComposerSubmitPlugin onSend={onSend} />
      <OnChangePlugin
        onChange={(state) => state.read(() => onChange($convertToMarkdownString(TRANSFORMERS)))}
      />
      <EditorRefPlugin editorRef={editorRef} />
      <ComposerReferenceMenuPlugin draft={draft} />
    </LexicalComposer>
  )
}

function ComposerTextArea({ referencesOpen }: { referencesOpen: boolean }) {
  const focusCameFromPointer = useRef(false)
  const [showsKeyboardFocus, setShowsKeyboardFocus] = useState(false)
  return (
    <RichTextPlugin
      ErrorBoundary={({ children }) => children}
      contentEditable={
        <ContentEditable
          aria-label="Message"
          aria-autocomplete="list"
          aria-controls={referencesOpen ? 'composer-references' : undefined}
          aria-expanded={referencesOpen}
          aria-placeholder="Direct the next move…"
          className="min-h-20 flex-1 whitespace-pre-wrap px-4 py-3 pr-28 type-body leading-6 outline-none data-[keyboard-focus=true]:ring-2 data-[keyboard-focus=true]:ring-ring [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:!text-session-title [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mb-1 [&_h2]:mt-4 [&_h2]:!text-composer-section [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:!text-session-heading [&_h3]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
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
          placeholder={composerPlaceholder}
        />
      }
      placeholder={composerPlaceholder}
    />
  )
}
