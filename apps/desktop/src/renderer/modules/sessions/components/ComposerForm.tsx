import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical'
import { ArrowUp } from 'lucide-react'
import type { RefObject } from 'react'

import { Button } from '../../../components/ui/button'
import { PendingTurns } from './PendingTurns'
import type { usePendingTurns } from './usePendingTurns'

function editorState(text: string) {
  return () => {
    const root = $getRoot()
    root.clear()
    root.append($createParagraphNode().append($createTextNode(text)))
  }
}

function ComposerEditor({
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
  return (
    <LexicalComposer
      initialConfig={{
        editorState: editorState(draft),
        namespace: 'argo-session-composer',
        onError: (error) => {
          throw error
        },
      }}
    >
      <PlainTextPlugin
        ErrorBoundary={({ children }) => children}
        contentEditable={
          <ContentEditable
            aria-label="Message"
            aria-placeholder="Direct the next move…"
            className="min-h-20 flex-1 whitespace-pre-wrap px-4 py-3 text-sm leading-6 outline-none"
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
              event.preventDefault()
              onSend()
            }}
            placeholder={
              <span
                aria-hidden="true"
                className="pointer-events-none absolute px-4 py-3 text-sm text-muted-foreground"
              >
                Direct the next move…
              </span>
            }
          />
        }
        placeholder={
          <span
            aria-hidden="true"
            className="pointer-events-none absolute px-4 py-3 text-sm text-muted-foreground"
          >
            Direct the next move…
          </span>
        }
      />
      <OnChangePlugin
        onChange={(state) => state.read(() => onChange($getRoot().getTextContent()))}
      />
      <EditorRefPlugin editorRef={editorRef} />
    </LexicalComposer>
  )
}

export function ComposerForm({
  draft,
  editorRef,
  isRunning,
  onChange,
  onEdit,
  onInterrupt,
  onRemove,
  onReorder,
  onSend,
  pendingTurns,
  sessionId,
}: {
  draft: string
  editorRef: RefObject<LexicalEditor | null>
  isRunning: boolean
  onChange: (text: string) => void
  onEdit: (turn: (typeof pendingTurns)[number]) => void
  onInterrupt?: () => Promise<boolean>
  onRemove: (id: string) => void
  onReorder: (sourceId: string, targetId: string) => void
  onSend: () => void
  pendingTurns: ReturnType<typeof usePendingTurns>['pendingTurns']
  sessionId: string
}) {
  return (
    <form
      className="mx-auto w-full max-w-4xl px-(--spacing-shell-gutter) pt-6 pb-8"
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      <PendingTurns
        turns={pendingTurns}
        onEdit={onEdit}
        onRemove={onRemove}
        onReorder={onReorder}
      />
      <div className="relative flex overflow-hidden rounded-xl border bg-card shadow-lg shadow-foreground/10">
        <div className="min-w-0 flex-1">
          <ComposerEditor
            key={sessionId}
            draft={draft}
            editorRef={editorRef}
            onChange={onChange}
            onSend={onSend}
          />
        </div>
        <div className="flex items-end p-2">
          {isRunning ? (
            <Button
              aria-label="Interrupt"
              onClick={() => void onInterrupt?.()}
              size="sm"
              type="button"
            >
              Interrupt
            </Button>
          ) : (
            <Button aria-label="Send message" disabled={!draft.trim()} size="icon-sm" type="submit">
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
