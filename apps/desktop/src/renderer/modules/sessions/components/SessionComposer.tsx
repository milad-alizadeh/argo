import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical'
import { ArrowUp } from 'lucide-react'
import { type RefObject, useCallback, useRef, useState } from 'react'

import { Button } from '../../../components/ui/button'

export type SessionComposerProps = {
  isRunning?: boolean
  onInterrupt?: () => Promise<boolean>
  sessionId: string
  onSend: (text: string) => Promise<boolean>
}

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
        onChange={(state) => {
          state.read(() => onChange($getRoot().getTextContent()))
        }}
      />
      <EditorRefPlugin editorRef={editorRef} />
    </LexicalComposer>
  )
}

export function SessionComposer({
  isRunning = false,
  onInterrupt,
  sessionId,
  onSend,
}: SessionComposerProps) {
  const [drafts, setDrafts] = useState(() => new Map<string, string>())
  const draft = drafts.get(sessionId) ?? ''
  // The editor owns its text and reports it up. Writing the draft back on every change raced a
  // keystroke typed before the re-render, dropping it and moving the caret to the start.
  const editorRef = useRef<LexicalEditor>(null)

  const changeDraft = useCallback(
    (text: string) => {
      setDrafts((current) => new Map(current).set(sessionId, text))
    },
    [sessionId],
  )

  const send = useCallback(async () => {
    if (!draft.trim()) return
    // Taken before the await: a Session switch mid-send remounts the editor under the ref.
    const editor = editorRef.current
    if (!(await onSend(draft))) return
    editor?.update(() => {
      $getRoot().clear().append($createParagraphNode())
    })
    setDrafts((current) => new Map(current).set(sessionId, ''))
  }, [draft, onSend, sessionId])

  const interrupt = useCallback(async () => {
    if (onInterrupt) await onInterrupt()
  }, [onInterrupt])

  return (
    <form
      className="mx-auto w-full max-w-4xl px-(--spacing-shell-gutter) pt-6 pb-8"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <div className="relative flex overflow-hidden rounded-xl border bg-card shadow-lg shadow-foreground/10">
        <div className="min-w-0 flex-1">
          <ComposerEditor
            key={sessionId}
            draft={draft}
            editorRef={editorRef}
            onChange={changeDraft}
            onSend={() => void send()}
          />
        </div>
        <div className="flex items-end p-2">
          {isRunning ? (
            <Button aria-label="Interrupt" onClick={() => void interrupt()} size="sm" type="button">
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
